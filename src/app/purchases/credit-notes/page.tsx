'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { creditNotes as initialCreditNotes } from '@/lib/data';
import type { CreditNote, Supplier } from '@/lib/types';
import { CreditNoteDialog } from '@/components/credit-note-dialog';
import { CreditNotesTable } from '@/components/credit-notes-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';


export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(initialCreditNotes);
  const firestore = useFirestore();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers } = useCollection<Supplier>(suppliersRef);


  const addCreditNote = (newCreditNote: CreditNote) => {
    setCreditNotes((prev) => [...prev, newCreditNote]);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Avoirs"
        description="Gérez vos notes de crédit."
      >
        <CreditNoteDialog
          suppliers={suppliers || []}
          onCreditNoteCreated={addCreditNote}
          lastCreditNoteNumber={creditNotes.length}
        />
      </PageHeader>
      
      <CreditNotesTable creditNotes={creditNotes} suppliers={suppliers || []} />
    </div>
  );
}
