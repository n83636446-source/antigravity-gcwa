'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseInvoice, Supplier, PurchaseOrder } from '@/lib/types';
import { PurchaseInvoiceDialog } from '@/components/purchase-invoice-dialog';
import { PurchaseInvoicesTable } from '@/components/purchase-invoices-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function PurchaseInvoicesPage() {
  const firestore = useFirestore();

  const invoicesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseInvoices') : null),
    [firestore]
  );
  const { data: invoices } = useCollection<PurchaseInvoice>(invoicesRef);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers } = useCollection<Supplier>(suppliersRef);

  const ordersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(ordersRef);

  const receivedOrders = useMemoFirebase(
    () => purchaseOrders?.filter((order) => order.status === 'Reçu') || [],
    [purchaseOrders]
  );

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Factures d'achat"
        description="Gérez vos factures fournisseurs."
      >
        <PurchaseInvoiceDialog
            purchaseOrders={receivedOrders}
            lastInvoiceNumber={invoices?.length || 0}
        />
      </PageHeader>
      <PurchaseInvoicesTable 
        invoices={invoices || []}
        purchaseOrders={purchaseOrders || []}
        suppliers={suppliers || []}
      />
    </div>
  );
}
