"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useApiCollection } from '@/hooks/use-api';
import { api } from '@/lib/api';
import {
  Supplier,
  PurchaseOrder,
  PurchaseReceipt,
  PurchaseInvoice,
  supplierFromApi,
  purchaseOrderFromApi,
  purchaseReceiptFromApi,
  purchaseInvoiceFromApi,
} from '@/lib/types';
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
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (dialogOpen || deleteDialogOpen) return;
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        if ((e.target as Element).closest('[role="dialog"], [role="tooltip"]')) return;
        setSelectedIds(new Set());
        lastClickedIndexRef.current = null;
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [dialogOpen, deleteDialogOpen]);

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

  const fetchSuppliers = useCallback(() => api.getSuppliers(), []);
  const fetchPurchaseOrders = useCallback(() => api.getPurchaseOrders(), []);
  const fetchPurchaseReceipts = useCallback(() => api.getPurchaseReceipts(), []);
  const fetchPurchaseInvoices = useCallback(() => api.getPurchaseInvoices(), []);

  const { data: rawSuppliers, isLoading: isLoadingSuppliers, refetch: refetchSuppliers } = useApiCollection(fetchSuppliers);
  const { data: rawPurchaseOrders } = useApiCollection(fetchPurchaseOrders);
  const { data: rawPurchaseReceipts } = useApiCollection(fetchPurchaseReceipts);
  const { data: rawPurchaseInvoices } = useApiCollection(fetchPurchaseInvoices);

  const suppliers: Supplier[] = useMemo(() => (rawSuppliers || []).map(supplierFromApi), [rawSuppliers]);

  const purchaseOrders: PurchaseOrder[] = useMemo(() => (rawPurchaseOrders || []).map(purchaseOrderFromApi), [rawPurchaseOrders]);
  const purchaseReceipts: PurchaseReceipt[] = useMemo(() => (rawPurchaseReceipts || []).map(purchaseReceiptFromApi), [rawPurchaseReceipts]);
  const purchaseInvoices: PurchaseInvoice[] = useMemo(() => (rawPurchaseInvoices || []).map(purchaseInvoiceFromApi), [rawPurchaseInvoices]);

  const sortedSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return [...suppliers].sort((a, b) => {
      const getVal = (code?: string) => {
        if (!code) return 999999;
        const digits = code.replace(/\D/g, '');
        return digits ? parseInt(digits, 10) : 999999;
      };
      return getVal(a.code) - getVal(b.code);
    });
  }, [suppliers]);

    const selectedSuppliers = sortedSuppliers.filter((s) => selectedIds.has(s.id));
  const singleSelected = selectedSuppliers.length === 1 ? selectedSuppliers[0] : null;

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  };

  const handleAdd = () => {
    setEditingSupplier(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleRowClick = (supplier: Supplier, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedIndexRef.current !== null) {
      const from = Math.min(lastClickedIndexRef.current, index);
      const to = Math.max(lastClickedIndexRef.current, index);
      const rangeIds = sortedSuppliers.slice(from, to + 1).map((a) => a.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(supplier.id)) next.delete(supplier.id);
        else next.add(supplier.id);
        return next;
      });
      lastClickedIndexRef.current = index;
    }
  };

  const handleDeleteConfirm = async () => {
    const usedIds = new Set<string>();
    [
      ...(purchaseOrders || []).flatMap(o => o.supplierId),
      ...(purchaseReceipts || []).flatMap(r => r.supplierId),
      ...(purchaseInvoices || []).flatMap(inv => inv.supplierId)
    ].forEach((id) => { if (selectedIds.has(id)) usedIds.add(id); });

    if (usedIds.size > 0) {
      const blockedNames = selectedSuppliers.filter((s) => usedIds.has(s.id)).map((s) => `"${s.name}"`).join(', ');
      toast({ variant: 'destructive', title: 'Suppression impossible', description: `Ces fournisseurs sont liés à des documents d'achat : ${blockedNames}`, duration: 6000 });
      setDeleteDialogOpen(false);
      return;
    }

    let successCount = 0, failCount = 0;
    let lastError = '';
    await Promise.all(
      selectedSuppliers.map(async (supplier) => {
        try { await api.deleteSupplier(supplier.id); successCount++; }
        catch(e: any) { console.error('DELETE ERROR:', e); failCount++; lastError = e.message; }
      })
    );

    toast(successCount > 0
      ? { title: `${successCount} fournisseur(s) supprimé(s)`, description: failCount > 0 ? `${failCount} échec(s): ${lastError}` : undefined }
      : { variant: 'destructive', title: 'Erreur', description: `Impossible de supprimer: ${lastError}` }
    );

    clearSelection();
    setDeleteDialogOpen(false);
    refetchSuppliers();
  };

  const isLoading = isLoadingSuppliers;


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
        <Card ref={cardRef} className="animate-in fade-in zoom-in-[0.98] duration-300 ease-out">
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
        <Card ref={cardRef} className="animate-in fade-in zoom-in-[0.98] duration-300 ease-out">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>
              Tous les fournisseurs
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className={cn(
              'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
              selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn('h-8 w-8 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]', singleSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                    onClick={() => singleSelected && handleEdit(singleSelected)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Supprimer {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer la sélection</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {sortedSuppliers.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                  <SuppliersTable
                    suppliers={sortedSuppliers}
                    onRowClick={handleRowClick}
                    onRowDoubleClick={handleEdit}
                    selectedIds={selectedIds}
                    columns={columns}
                    columnIds={columnIds}
                  />
                </SortableContext>
              </DndContext>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h3 className="text-2xl font-bold tracking-tight">
                    Vous n'avez pas encore de fournisseurs.
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Commencez par en créer un.
                  </p>
                  <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un fournisseur
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <SupplierDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) refetchSuppliers();
        }}
        supplier={editingSupplier}
        suppliers={suppliers || []}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedIds.size > 1 ? `Supprimer ${selectedIds.size} fournisseurs ?` : 'Supprimer ce fournisseur ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size > 1
                ? `Cette action est irréversible. Les ${selectedIds.size} fournisseurs sélectionnés seront définitivement supprimés.`
                : `Cette action est irréversible. Le fournisseur "${selectedSuppliers[0]?.name}" sera définitivement supprimé.`}
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
