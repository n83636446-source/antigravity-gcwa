'use client';

import { PageHeader } from '@/components/page-header';
import { ClientDialog } from '@/components/client-dialog';
import { ClientsTable } from '@/components/clients-table';
import type { Client } from '@/lib/types';
import { useState } from 'react';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Clients"
        description="Gérez votre liste de clients."
      >
        <ClientDialog />
      </PageHeader>
      <ClientsTable clients={clients} />
    </div>
  );
}
