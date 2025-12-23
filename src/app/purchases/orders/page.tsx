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
import type { PurchaseOrder, Supplier, Product } from '@/lib/types';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, collectionGroup, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
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

export default function PurchaseOrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | undefined>();
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);


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


  const ordersRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'purchaseOrders'), orderBy('orderDate', 'desc')) : null),
    [firestore]
  );
  const { data: orders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(ordersRef);


  const getSupplierName = (supplierId: string) => {
    return suppliers?.find(s => s.id === supplierId)?.name ?? 'Inconnu';
  };

  const handleAdd = () => {
    setEditingOrder(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const handleSelectOrder = (order: PurchaseOrder) => {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null); // Deselect if clicking the same row
    } else {
      setSelectedOrder(order);
    }
  };

  const handleDeleteRequest = (order: PurchaseOrder) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!firestore || !orderToDelete) return;
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

  const handleContainerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('tr')) {
      return;
    }
    setSelectedOrder(null);
  };

  const isLoading = isLoadingSuppliers || isLoadingOrders || isLoadingProducts;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6" onClick={handleContainerClick}>
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
                    <Button variant="outline" size="sm" onClick={() => handleEdit(selectedOrder)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteRequest(selectedOrder)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                    </Button>
                  </div>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => (
                           <TableRow
                            key={order.id}
                            onClick={() => handleSelectOrder(order)}
                            onDoubleClick={() => handleEdit(order)}
                            className={cn("cursor-pointer", selectedOrder?.id === order.id && 'bg-muted/50')}
                           >
                             <TableCell className="font-medium">{order.orderNumber}</TableCell>
                             <TableCell>{getSupplierName(order.supplierId)}</TableCell>
                             <TableCell>{format(new Date(order.orderDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                             <TableCell className="text-right">
                                {new Intl.NumberFormat('fr-FR', {
                                  style: 'currency',
                                  currency: 'EUR',
                                }).format(order.totalAmount)}
                             </TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
