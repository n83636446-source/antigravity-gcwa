'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { CreditNote, Supplier, PurchaseOrder, Product } from '@/lib/types';
import { CreditNoteDialog } from '@/components/credit-note-dialog';
import { CreditNotesTable } from '@/components/credit-notes-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';


export default function CreditNotesPage() {
  const firestore = useFirestore();

  const creditNotesRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'creditNotes'), orderBy('creditNoteDate', 'desc')) : null),
    [firestore]
  );
  const { data: creditNotes } = useCollection<CreditNote>(creditNotesRef);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers } = useCollection<Supplier>(suppliersRef);

  const purchaseOrdersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(purchaseOrdersRef);

  const productsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products } = useCollection<Product>(productsRef);
  
  const lastCreditNoteNumber = useMemo(() => {
    if (!creditNotes || creditNotes.length === 0) {
      return 0;
    }
    return creditNotes.reduce((max, note) => {
      const codeNumber = parseInt((note.creditNoteNumber || 'AV-0000').replace('AV-', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [creditNotes]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Avoirs"
        description="Gérez vos notes de crédit."
      >
        <CreditNoteDialog
          suppliers={suppliers || []}
          creditNotes={creditNotes || []}
          purchaseOrders={purchaseOrders || []}
          products={products || []}
          lastCreditNoteNumber={lastCreditNoteNumber}
        />
      </PageHeader>
      
      <CreditNotesTable creditNotes={creditNotes || []} suppliers={suppliers || []} />
    </div>
  );
}
