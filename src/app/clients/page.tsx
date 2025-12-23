'use client';

import { PageHeader } from '@/components/page-header';
import { ClientDialog } from '@/components/client-dialog';
import { ClientsTable } from '@/components/clients-table';
import type { Client } from '@/lib/types';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

export default function ClientsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const clientsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'clients') : null),
    [firestore]
  );
  const { data: clients, isLoading } = useCollection<Client>(clientsRef);

  const handleAdd = () => {
    setEditingClient(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    if (!firestore) return;
    const clientDocRef = doc(firestore, 'clients', client.id);
    deleteDocumentNonBlocking(clientDocRef);
    toast({
      title: 'Client supprimé',
      description: `Le client "${client.name}" a été supprimé.`,
    });
    setSelectedClient(null);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Clients"
        description="Gérez votre liste de clients."
      >
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un client
        </Button>
      </PageHeader>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <ClientsTable
          clients={clients || []}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedClient={selectedClient}
          onSetSelectedClient={setSelectedClient}
        />
      )}
      <ClientDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
      />
    </div>
  );
}
