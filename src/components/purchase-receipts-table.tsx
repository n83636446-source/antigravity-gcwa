'use client';

import type {
  PurchaseReceipt,
  PurchaseOrder,
  Supplier,
} from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from './ui/badge';

type PurchaseReceiptsTableProps = {
  receipts: PurchaseReceipt[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
};

export function PurchaseReceiptsTable({
  receipts,
  purchaseOrders,
  suppliers,
}: PurchaseReceiptsTableProps) {
  const getOrderDetails = (orderId: string) => {
    const order = purchaseOrders.find((o) => o.id === orderId);
    if (!order) return { orderNumber: 'Inconnu', supplierName: 'Inconnu' };
    const supplier = suppliers.find((s) => s.id === order.supplierId);
    return {
      orderNumber: order.orderNumber,
      supplierName: supplier?.name ?? 'Inconnu',
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bons de réception récents</CardTitle>
      </CardHeader>
      <CardContent>
        {receipts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro BR</TableHead>
                <TableHead>Numéro BC</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date de réception</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => {
                const { orderNumber, supplierName } = getOrderDetails(
                  receipt.purchaseOrderId
                );
                return (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">
                      {receipt.receiptNumber}
                    </TableCell>
                    <TableCell>{orderNumber}</TableCell>
                    <TableCell>{supplierName}</TableCell>
                    <TableCell>
                      {format(new Date(receipt.receiptDate), 'dd/MM/yyyy', {
                        locale: fr,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">
                Vous n'avez pas encore de bons de réception.
              </h3>
              <p className="text-sm text-muted-foreground">
                Commencez par en créer un.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
