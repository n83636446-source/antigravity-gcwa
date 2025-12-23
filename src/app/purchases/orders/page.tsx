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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PurchaseOrderDialog } from '@/components/purchase-order-dialog';
import type { PurchaseOrder, Supplier } from '@/lib/types';
import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function PurchaseOrdersPage() {
  const firestore = useFirestore();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);

  const ordersRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'purchaseOrders'), orderBy('orderDate', 'desc')) : null),
    [firestore]
  );
  const { data: orders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(ordersRef);


  const getSupplierName = (supplierId: string) => {
    return suppliers?.find(s => s.id === supplierId)?.name ?? 'Inconnu';
  };

  const getStatusVariant = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Brouillon':
        return 'secondary';
      case 'Envoyé':
        return 'default';
      case 'Reçu':
        return 'outline';
      case 'Annulé':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const isLoading = isLoadingSuppliers || isLoadingOrders;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de commande"
        description="Gérez vos bons de commande."
      >
        <PurchaseOrderDialog
          suppliers={suppliers || []}
          lastOrderNumber={orders?.length || 0}
        />
      </PageHeader>
      
      {isLoading ? (
         <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : orders && orders.length > 0 ? (
        <Card>
            <CardHeader>
                <CardTitle>Bons de commande récents</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => (
                           <TableRow key={order.id}>
                             <TableCell className="font-medium">{order.orderNumber}</TableCell>
                             <TableCell>{getSupplierName(order.supplierId)}</TableCell>
                             <TableCell>{format(new Date(order.orderDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                             <TableCell className="text-right">
                                {new Intl.NumberFormat('fr-FR', {
                                  style: 'currency',
                                  currency: 'EUR',
                                }).format(order.totalAmount)}
                             </TableCell>
                             <TableCell>
                               <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
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
    </div>
  );
}
