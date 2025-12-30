'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { TestResizableDialog } from '@/components/test-resizable-dialog';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { PurchaseOrder, PurchaseReceipt, Product, Supplier } from '@/lib/types';

export default function TestResizePage() {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();

  const ordersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'purchaseOrders') : null), [firestore]);
  const { data: purchaseOrders = [] } = useCollection<PurchaseOrder>(ordersRef);

  const receiptsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'purchaseReceipts') : null), [firestore]);
  const { data: receipts = [] } = useCollection<PurchaseReceipt>(receiptsRef);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: products = [] } = useCollection<Product>(productsRef);

  const suppliersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: suppliers = [] } = useCollection<Supplier>(suppliersRef);

  const lastReceiptNumber = receipts.length;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Page de test pour le redimensionnement"
        description="Cliquez sur le bouton pour ouvrir une boîte de dialogue de test."
      />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8">
        <Button onClick={() => setIsOpen(true)}>Ouvrir la boîte de dialogue de test</Button>
      </div>
      <TestResizableDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        purchaseOrders={purchaseOrders}
        receipts={receipts}
        products={products}
        suppliers={suppliers}
        lastReceiptNumber={lastReceiptNumber}
      />
    </div>
  );
}
