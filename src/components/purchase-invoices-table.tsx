
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
import { Button } from './ui/button';
import { PurchaseInvoiceDialog } from './purchase-invoice-dialog';
import { PlusCircle } from 'lucide-react';


type Column = {
    id: 'invoiceNumber' | 'orderNumber' | 'supplierName' | 'invoiceDate' | 'dueDate' | 'totalTTC' | 'status';
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
  columnIds: ('invoiceNumber' | 'orderNumber' | 'supplierName' | 'invoiceDate' | 'dueDate' | 'totalTTC' | 'status')[];
  onNewInvoiceClick: () => void;
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
  onNewInvoiceClick
}: PurchaseInvoicesTableProps) {
  const getInvoiceDetails = (invoice: PurchaseInvoice) => {
    let orderNumber = 'N/A';
    let supplierName = 'Inconnu';
    
    const supplier = suppliers.find((s) => s.id === invoice.supplierId);
    if (supplier) {
      supplierName = supplier.name;
    }

    if (invoice.purchaseOrderId) {
      const order = purchaseOrders.find((o) => o.id === invoice.purchaseOrderId);
      if (order) {
        orderNumber = order.orderNumber;
      }
    }
    
    return { orderNumber, supplierName };
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
    const { orderNumber, supplierName } = getInvoiceDetails(invoice);

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
      case 'totalTTC':
        return (
          <TableCell key={key} className="text-right">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.totalTTC)}
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
                    <DraggableHeader key={id} id={id} className={cn(id === 'totalTTC' && 'text-right')}>
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
               <Button className="mt-4" onClick={onNewInvoiceClick}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer une facture d'achat
                </Button>
            </div>
          </div>
        )}
        </>
  );
}
