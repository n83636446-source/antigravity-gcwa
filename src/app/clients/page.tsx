'use client';

import { PageHeader } from '@/components/page-header';
import { ClientDialog } from '@/components/client-dialog';
import { ClientsTable } from '@/components/clients-table';
import { Client, clientFromApi } from '@/lib/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApiCollection } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ClientsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fetchClients = useCallback(() => api.getClients(), []);
  const { data: rawClients, isLoading, refetch } = useApiCollection(fetchClients);
  const clients: Client[] = useMemo(() => (rawClients || []).map(clientFromApi), [rawClients]);
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find(item => item.id === selectedClient.id);
      if (updated && updated !== selectedClient) {
        setSelectedClient(updated);
      }
    }
  }, [clients, selectedClient]);

  const handleAdd = () => {
    setEditingClient(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = async (client: Client) => {
    try {
      await api.deleteClient(client.id);
      toast({
        title: 'Client supprimé',
        description: `Le client "${client.name}" a été supprimé.`,
      });
      refetch();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Impossible de supprimer le client "${client.name}".`,
      });
    }
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
          clients={clients}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={handleAdd}
          selectedClient={selectedClient}
          onSetSelectedClient={setSelectedClient}
        />
      )}
      <ClientDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) refetch();
        }}
        client={editingClient}
      />
    </div>
  );
}

