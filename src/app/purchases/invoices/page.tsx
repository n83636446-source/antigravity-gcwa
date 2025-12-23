'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  purchaseOrders,
  purchaseInvoices as initialPurchaseInvoices,
} from '@/lib/data';
import type { PurchaseInvoice, Supplier } from '@/lib/types';
import { PurchaseInvoiceDialog } from '@/components/purchase-invoice-dialog';
import { PurchaseInvoicesTable } from '@/components/purchase-invoices-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(initialPurchaseInvoices);
  const firestore = useFirestore();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers } = useCollection<Supplier>(suppliersRef);

  const addInvoice = (newInvoice: PurchaseInvoice) => {
    setInvoices((prevInvoices) => [...prevInvoices, newInvoice]);
  };

  const receivedOrders = purchaseOrders.filter(
    (order) => order.status === 'Reçu'
  );

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Factures d'achat"
        description="Gérez vos factures fournisseurs."
      >
        <PurchaseInvoiceDialog
            purchaseOrders={receivedOrders}
            onInvoiceCreated={addInvoice}
            lastInvoiceNumber={invoices.length}
        />
      </PageHeader>
      <PurchaseInvoicesTable 
        invoices={invoices}
        purchaseOrders={purchaseOrders}
        suppliers={suppliers || []}
      />
    </div>
  );
}
