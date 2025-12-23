'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, doc, collectionGroup, query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Supplier, Product, PurchaseOrder, CreditNote } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { SuppliersTable } from '@/components/suppliers-table';
import { SupplierDialog } from '@/components/supplier-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableHeader } from '@/components/ui/DraggableHeader';
import { cn } from '@/lib/utils';

type Column = {
  id: keyof Supplier | 'address';
  label: string;
};

const initialColumns: Column[] = [
  { id: 'code', label: 'Code' },
  { id: 'name', label: 'Nom de l\'entreprise' },
  { id: 'ice', label: 'ICE' },
  { id: 'address', label: 'Adresse' },
  { id: 'contactName', label: 'Personne à contacter' },
  { id: 'contactEmail', label: 'Email' },
  { id: 'contactPhone', label: 'Téléphone' },
];

export default function SuppliersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  useEffect(() => {
    try {
      const savedColumns = localStorage.getItem('suppliersColumns');
      if (savedColumns) {
        const parsedColumns: Column[] = JSON.parse(savedColumns);
        const savedColumnIds = new Set(parsedColumns.map(c => c.id));
        const initialColumnIds = new Set(initialColumns.map(c => c.id));
        
        if (parsedColumns.length === initialColumns.length && [...savedColumnIds].every(id => initialColumnIds.has(id))) {
          setColumns(parsedColumns);
        }
      }
    } catch (error) {
      console.error("Failed to load or parse columns from localStorage", error);
    }
  }, []);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = columnIds.indexOf(active.id as any);
        const newIndex = columnIds.indexOf(over.id as any);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        try {
          localStorage.setItem('suppliersColumns', JSON.stringify(newOrder));
        } catch (error) {
          console.error("Failed to save columns to localStorage", error);
        }
        return newOrder;
      });
    }
  }


  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);

  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'products')) : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  const purchaseOrdersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(purchaseOrdersRef);

  const creditNotesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'creditNotes') : null),
    [firestore]
  );
  const { data: creditNotes, isLoading: isLoadingCreditNotes } = useCollection<CreditNote>(creditNotesRef);


  const lastSupplierCodeNumber = useMemo(() => {
    if (!suppliers || suppliers.length === 0) {
      return 0;
    }
    return suppliers.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'FOU0').replace('FOU', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [suppliers]);

  const handleAdd = () => {
    setEditingSupplier(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    if (selectedSupplier?.id === supplier.id) {
      setSelectedSupplier(null);
    } else {
      setSelectedSupplier(supplier);
    }
  };

  const handleDeleteRequest = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!firestore || !supplierToDelete) return;
  
    const isUsedInProducts = (products || []).some(
      (product) => product.supplierId === supplierToDelete.id
    );
  
    const isUsedInOrders = (purchaseOrders || []).some(
      (order) => order.supplierId === supplierToDelete.id
    );
  
    const isUsedInCreditNotes = (creditNotes || []).some(
      (note) => note.supplierId === supplierToDelete.id
    );
  
    let usedInMessage = '';
    if (isUsedInProducts) usedInMessage = 'des articles';
    else if (isUsedInOrders) usedInMessage = 'des bons de commande';
    else if (isUsedInCreditNotes) usedInMessage = 'des avoirs';
  
    if (usedInMessage) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: `Le fournisseur "${supplierToDelete.name}" est lié à ${usedInMessage} et ne peut pas être supprimé.`,
        duration: 5000,
      });
      setDeleteDialogOpen(false);
      return;
    }
  
    const supplierDocRef = doc(firestore, 'suppliers', supplierToDelete.id);
    deleteDocumentNonBlocking(supplierDocRef);
    toast({
      title: 'Fournisseur supprimé',
      description: `Le fournisseur "${supplierToDelete.name}" a été supprimé.`,
    });
    setDeleteDialogOpen(false);
    setSupplierToDelete(null);
    setSelectedSupplier(null);
  };

  const isLoading = isLoadingSuppliers || isLoadingProducts || isLoadingOrders || isLoadingCreditNotes;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Fournisseurs"
        description="Gérez votre liste de fournisseurs."
      >
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un fournisseur
        </Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Tous les fournisseurs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tous les fournisseurs</CardTitle>
            {selectedSupplier && (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(selectedSupplier)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Modifier</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteRequest(selectedSupplier)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Supprimer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer</TooltipContent>
                </Tooltip>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                <SuppliersTable
                  suppliers={suppliers || []}
                  onRowClick={handleSelectSupplier}
                  onRowDoubleClick={handleEdit}
                  selectedSupplierId={selectedSupplier?.id}
                  columns={columns}
                  columnIds={columnIds}
                />
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}

      <SupplierDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        lastSupplierCodeNumber={lastSupplierCodeNumber}
        suppliers={suppliers || []}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Êtes-vous sûr de vouloir supprimer ce fournisseur ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le fournisseur "
              {supplierToDelete?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
