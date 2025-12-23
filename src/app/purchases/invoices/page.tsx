'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseInvoice, Supplier, PurchaseOrder } from '@/lib/types';
import { PurchaseInvoiceDialog } from '@/components/purchase-invoice-dialog';
import { PurchaseInvoicesTable } from '@/components/purchase-invoices-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function PurchaseInvoicesPage() {
  const firestore = useFirestore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);

  const invoicesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseInvoices') : null),
    [firestore]
  );
  const { data: invoices, isLoading: isLoadingInvoices } = useCollection<PurchaseInvoice>(invoicesRef);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);

  const ordersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(ordersRef);
  
  const isLoading = isLoadingInvoices || isLoadingSuppliers || isLoadingOrders;

  const handleRowClick = (invoice: PurchaseInvoice) => {
    if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(null);
    } else {
        setSelectedInvoice(invoice);
    }
  };
  
  const handleRowDoubleClick = (invoice: PurchaseInvoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };
  
  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingInvoice(null);
    }
  };


  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Factures d'achat"
        description="Gérez vos factures fournisseurs."
      >
        <PurchaseInvoiceDialog
            purchaseOrders={purchaseOrders || []}
            lastInvoiceNumber={invoices?.length || 0}
        />
      </PageHeader>
      {isLoading ? (
         <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <PurchaseInvoicesTable 
          invoices={invoices || []}
          purchaseOrders={purchaseOrders || []}
          suppliers={suppliers || []}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          selectedInvoiceId={selectedInvoice?.id}
        />
      )}
       <PurchaseInvoiceDialog
          isOpen={dialogOpen}
          onOpenChange={handleOpenChange}
          purchaseOrders={purchaseOrders || []}
          lastInvoiceNumber={invoices?.length || 0}
          invoice={editingInvoice}
        />
    </div>
  );
}
