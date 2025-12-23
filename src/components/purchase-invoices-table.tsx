
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
import { useMemo, ReactNode } from 'react';
import { DraggableHeader } from './ui/DraggableHeader';


type Column = {
    id: 'invoiceNumber' | 'orderNumber' | 'supplierName' | 'invoiceDate' | 'dueDate' | 'totalAmount' | 'status';
    label: string;
};

type PurchaseInvoicesTableProps = {
  invoices: PurchaseInvoice[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  onRowClick: (invoice: PurchaseInvoice) => void;
  onRowDoubleClick: (invoice: PurchaseInvoice) => void;
  selectedInvoiceId?: string | null;
  columns: Column[];
  columnIds: ('invoiceNumber' | 'orderNumber' | 'supplierName' | 'invoiceDate' | 'dueDate' | 'totalAmount' | 'status')[];
};

export function PurchaseInvoicesTable({
  invoices,
  purchaseOrders,
  suppliers,
  onRowClick,
  onRowDoubleClick,
  selectedInvoiceId,
  columns,
  columnIds,
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

  const sortedInvoices = useMemo(() => {
    return [...(invoices || [])].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [invoices]);

  const renderCellContent = (invoice: PurchaseInvoice, columnId: Column['id']): ReactNode => {
    const key = `${invoice.id}-${columnId}`;
    const { orderNumber, supplierName } = getOrderDetails(invoice.purchaseOrderId);

    switch (columnId) {
      case 'invoiceNumber':
        return <TableCell key={key} className="font-medium">{invoice.invoiceNumber}</TableCell>;
      case 'orderNumber':
        return <TableCell key={key}>{orderNumber}</TableCell>;
      case 'supplierName':
        return <TableCell key={key}>{supplierName}</TableCell>;
      case 'invoiceDate':
        return <TableCell key={key}>{format(new Date(invoice.invoiceDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>;
      case 'dueDate':
        return <TableCell key={key}>{format(new Date(invoice.dueDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>;
      case 'totalAmount':
        return (
          <TableCell key={key} className="text-right">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.totalAmount)}
          </TableCell>
        );
      case 'status':
        return (
          <TableCell key={key}>
            <Badge variant={getStatusVariant(invoice.status)}>{invoice.status}</Badge>
          </TableCell>
        );
      default:
        return <TableCell key={key}></TableCell>;
    }
  };


  return (
        <>
        {invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(({ id, label }) => (
                    <DraggableHeader key={id} id={id} className={cn(id === 'totalAmount' && 'text-right')}>
                        {label}
                    </DraggableHeader>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvoices.map((invoice) => {
                return (
                  <TableRow 
                    key={invoice.id}
                    onClick={() => onRowClick(invoice)}
                    onDoubleClick={() => onRowDoubleClick(invoice)}
                    className={cn("cursor-pointer", selectedInvoiceId === invoice.id && 'bg-muted/50')}
                  >
                     {columnIds.map((columnId) => renderCellContent(invoice, columnId))}
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
        </>
  );
}
