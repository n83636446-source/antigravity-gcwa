'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { suppliers, creditNotes as initialCreditNotes } from '@/lib/data';
import type { CreditNote } from '@/lib/types';
import { CreditNoteDialog } from '@/components/credit-note-dialog';
import { CreditNotesTable } from '@/components/credit-notes-table';


export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(initialCreditNotes);

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
          suppliers={suppliers}
          onCreditNoteCreated={addCreditNote}
          lastCreditNoteNumber={creditNotes.length}
        />
      </PageHeader>
      
      <CreditNotesTable creditNotes={creditNotes} suppliers={suppliers} />
    </div>
  );
}
