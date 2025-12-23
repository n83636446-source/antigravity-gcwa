'use client';

import { PageHeader } from '@/components/page-header';

export default function ProspectsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Prospects"
        description="Gérez votre liste de prospects."
      />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Page en construction
            </h3>
            <p className="text-sm text-muted-foreground">
              La fonctionnalité de gestion des prospects sera bientôt disponible.
            </p>
          </div>
        </div>
    </div>
  );
}
