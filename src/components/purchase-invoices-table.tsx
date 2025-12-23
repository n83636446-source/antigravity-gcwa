
'use client';

import type {
  PurchaseInvoice,
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
import { cn } from '@/lib/utils';

type PurchaseInvoicesTableProps = {
  invoices: PurchaseInvoice[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  onRowClick: (invoice: PurchaseInvoice) => void;
  onRowDoubleClick: (invoice: PurchaseInvoice) => void;
  selectedInvoiceId?: string | null;
};

export function PurchaseInvoicesTable({
  invoices,
  purchaseOrders,
  suppliers,
  onRowClick,
  onRowDoubleClick,
  selectedInvoiceId,
}: PurchaseInvoicesTableProps) {
  const getOrderDetails = (orderId: string) => {
    const order = purchaseOrders.find((o) => o.id === orderId);
    if (!order) return { orderNumber: 'Inconnu', supplierName: 'Inconnu' };
    const supplier = suppliers.find((s) => s.id === order.supplierId);
    return {
      orderNumber: order.orderNumber,
      supplierName: supplier?.name ?? 'Inconnu',
    };
  };
  
    const getStatusVariant = (status: PurchaseInvoice['status']) => {
    switch (status) {
      case 'Brouillon':
        return 'secondary';
      case 'Non payée':
        return 'default';
       case 'En retard':
        return 'destructive';
      case 'Payée':
        return 'outline';
      default:
        return 'default';
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Factures d'achat récentes</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro Facture</TableHead>
                <TableHead>Numéro BC</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date Facture</TableHead>
                <TableHead>Date d'échéance</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const { orderNumber, supplierName } = getOrderDetails(
                  invoice.purchaseOrderId
                );
                return (
                  <TableRow 
                    key={invoice.id}
                    onClick={() => onRowClick(invoice)}
                    onDoubleClick={() => onRowDoubleClick(invoice)}
                    className={cn("cursor-pointer", selectedInvoiceId === invoice.id && 'bg-muted/50')}
                  >
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{orderNumber}</TableCell>
                    <TableCell>{supplierName}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy', {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.dueDate), 'dd/MM/yyyy', {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                       {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(invoice.totalAmount)}
                    </TableCell>
                    <TableCell>
                        <Badge variant={getStatusVariant(invoice.status)}>{invoice.status}</Badge>
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
                Vous n'avez pas encore de factures.
              </h3>
              <p className="text-sm text-muted-foreground">
                Commencez par en créer une.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
