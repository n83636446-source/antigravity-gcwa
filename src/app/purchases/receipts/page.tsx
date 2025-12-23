'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  purchaseOrders,
  purchaseReceipts as initialPurchaseReceipts,
  products,
  suppliers,
} from '@/lib/data';
import type { PurchaseReceipt } from '@/lib/types';
import { PurchaseReceiptDialog } from '@/components/purchase-receipt-dialog';
import { PurchaseReceiptsTable } from '@/components/purchase-receipts-table';

export default function PurchaseReceiptsPage() {
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>(
    initialPurchaseReceipts
  );

  const addReceipt = (newReceipt: PurchaseReceipt) => {
    setReceipts((prevReceipts) => [...prevReceipts, newReceipt]);
  };

  const availableOrders = purchaseOrders.filter(
    (order) => order.status === 'Envoyé'
  );

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de réception"
        description="Gérez vos bons de réception."
      >
        <PurchaseReceiptDialog
          purchaseOrders={availableOrders}
          products={products}
          onReceiptCreated={addReceipt}
          lastReceiptNumber={receipts.length}
        />
      </PageHeader>
      <PurchaseReceiptsTable
        receipts={receipts}
        purchaseOrders={purchaseOrders}
        suppliers={suppliers}
      />
    </div>
  );
}
