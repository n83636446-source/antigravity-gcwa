'use client';

import { PageHeader } from '@/components/page-header';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PurchaseOrderDialog } from '@/components/purchase-order-dialog';
import type { PurchaseOrder, Supplier, Product, PurchaseReceipt } from '@/lib/types';
import { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PurchaseReceiptDialog } from '@/components/purchase-receipt-dialog';

type Column = {
  id: keyof PurchaseOrder | 'supplierName' | 'formattedDate' | 'formattedAmount';
  label: string;
};

const initialColumns: Column[] = [
  { id: 'orderNumber', label: 'Numéro' },
  { id: 'supplierName', label: 'Fournisseur' },
  { id: 'formattedDate', label: 'Date' },
  { id: 'formattedAmount', label: 'Montant' },
];

export default function PurchaseOrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | undefined>();
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  
  useEffect(() => {
    try {
      const savedColumns = localStorage.getItem('purchaseOrderColumns');
      if (savedColumns) {
        const parsedColumns: Column[] = JSON.parse(savedColumns);
        const savedColumnIds = new Set(parsedColumns.map(c => c.id));
        const initialColumnIds = new Set(initialColumns.map(c => c.id));
        
        // Basic validation to ensure saved columns are valid
        if (parsedColumns.length === initialColumns.length && [...savedColumnIds].every(id => initialColumnIds.has(id))) {
          setColumns(parsedColumns);
        }
      }
    } catch (error) {
      console.error("Failed to load or parse columns from localStorage", error);
      // Silently fail and use initialColumns
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
          localStorage.setItem('purchaseOrderColumns', JSON.stringify(newOrder));
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

  const productsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);


  const ordersRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'purchaseOrders'), orderBy('orderDate', 'desc')) : null),
    [firestore]
  );
  const { data: orders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(ordersRef);

  const receiptsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseReceipts') : null),
    [firestore]
  );
  const { data: receipts } = useCollection<PurchaseReceipt>(receiptsRef);

  const getSupplierName = (supplierId: string) => {
    return suppliers?.find(s => s.id === supplierId)?.name ?? 'Inconnu';
  };
  
  const enrichedOrders = useMemo(() => {
    return (orders || []).map(order => ({
      ...order,
      supplierName: getSupplierName(order.supplierId),
      formattedDate: format(new Date(order.orderDate), 'dd/MM/yyyy', { locale: fr }),
      formattedAmount: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(order.totalAmount),
    }));
  }, [orders, suppliers]);


  const handleAdd = () => {
    setEditingOrder(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };
  
  const handleTransfer = () => {
    if (selectedOrder) {
      setReceiptDialogOpen(true);
    }
  };

  const handleRowClick = (order: PurchaseOrder) => {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
    } else {
      setSelectedOrder(order);
    }
  };

  const handleDoubleClick = (order: PurchaseOrder) => {
    handleEdit(order);
  };

  const handleDeleteRequest = (order: PurchaseOrder) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!firestore || !orderToDelete) return;

    const isOrderInReceipt = (receipts || []).some(
      (receipt) => receipt.purchaseOrderId === orderToDelete.id
    );

    if (isOrderInReceipt) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: `Le bon de commande "${orderToDelete.orderNumber}" a déjà été transféré en bon de réception.`,
      });
      setDeleteDialogOpen(false);
      return;
    }

    const orderDocRef = doc(firestore, 'purchaseOrders', orderToDelete.id);
    deleteDocumentNonBlocking(orderDocRef);
    toast({
      title: 'Bon de commande supprimé',
      description: `Le bon de commande "${orderToDelete.orderNumber}" a été supprimé.`,
    });
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
    setSelectedOrder(null);
  };
  
  const handleReceiptCreated = () => {
    // This will trigger a re-fetch of the receipts collection implicitly
    // and ensures the UI is up-to-date.
    setSelectedOrder(null);
  };

  const isLoading = isLoadingSuppliers || isLoadingOrders || isLoadingProducts;
  
  const renderCellContent = (order: any, columnId: Column['id']) => {
    const key = `${order.id}-${columnId}`;
    switch (columnId) {
      case 'orderNumber':
        return <TableCell key={key} className="font-medium">{order.orderNumber}</TableCell>;
      case 'supplierName':
        return <TableCell key={key}>{order.supplierName}</TableCell>;
      case 'formattedDate':
        return <TableCell key={key}>{order.formattedDate}</TableCell>;
      case 'formattedAmount':
        return <TableCell key={key} className="text-right">{order.formattedAmount}</TableCell>;
      default:
        return <TableCell key={key}></TableCell>;
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de commande"
        description="Gérez vos bons de commande."
      >
        <Button onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Créer un bon de commande
        </Button>
      </PageHeader>
      
      {isLoading ? (
         <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : orders && orders.length > 0 ? (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Bons de commande récents</CardTitle>
                {selectedOrder && (
                  <div className="flex items-center gap-2">
                     <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleTransfer}>
                          <ArrowRightLeft className="h-4 w-4" />
                          <span className="sr-only">Transférer en BR</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Transférer en BR</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(selectedOrder)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Modifier</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteRequest(selectedOrder)}>
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
                    <Table>
                      <TableHeader>
                          <TableRow>
                            {columns.map(({ id, label }) => (
                              <DraggableHeader key={id} id={id} className={cn(id === 'formattedAmount' && 'text-right')}>
                                {label}
                              </DraggableHeader>
                            ))}
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {enrichedOrders.map(order => (
                             <TableRow
                              key={order.id}
                              onClick={() => handleRowClick(order)}
                              onDoubleClick={() => handleDoubleClick(order)}
                              className={cn("cursor-pointer", selectedOrder?.id === order.id && 'bg-muted/50')}
                             >
                              {columnIds.map((columnId) => renderCellContent(order, columnId))}
                             </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
            </CardContent>
        </Card>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Vous n'avez pas encore de bons de commande.
            </h3>
            <p className="text-sm text-muted-foreground">
              Commencez par en créer un.
            </p>
          </div>
        </div>
      )}
      <PurchaseOrderDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        suppliers={suppliers || []}
        products={products || []}
        order={editingOrder}
        lastOrderNumber={orders?.length || 0}
      />
       {selectedOrder && (
        <PurchaseReceiptDialog
          isOpen={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          purchaseOrders={orders || []}
          receipts={receipts || []}
          purchaseOrder={selectedOrder}
          products={products || []}
          suppliers={suppliers || []}
          lastReceiptNumber={receipts?.length || 0}
          onReceiptCreated={handleReceiptCreated}
        />
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce bon de commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le bon de commande "{orderToDelete?.orderNumber}" sera définitivement supprimé.
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
