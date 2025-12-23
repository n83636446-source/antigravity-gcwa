'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreditNotesPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Avoirs"
        description="Gérez vos notes de crédit."
      >
        <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Créer un avoir
        </Button>
      </PageHeader>
      
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Vous n'avez pas encore d'avoirs.
          </h3>
          <p className="text-sm text-muted-foreground">
            Commencez par en créer un.
          </p>
        </div>
      </div>
    </div>
  );
}
