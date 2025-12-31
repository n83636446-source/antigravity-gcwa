'use client';

import { TestResizableDialog } from '@/components/test-resizable-dialog';
import { PageHeader } from '@/components/page-header';

export default function TestResizePage() {

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Page de test pour le redimensionnement"
        description="Cliquez sur le bouton pour ouvrir une boîte de dialogue de test."
      />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8">
        <TestResizableDialog />
      </div>
    </div>
  );
}
