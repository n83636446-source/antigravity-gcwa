'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { ClientDialog } from '@/components/client-dialog';
import { Client, clientFromApi } from '@/lib/types';
import { useApiCollection } from '@/hooks/use-api';
import { useBulkAction } from '@/hooks/use-bulk-action';
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const columns: DataTableColumn<Client>[] = [
  { id: 'name', label: 'Nom', cell: (c) => c.name, sortValue: (c) => c.name, className: 'font-medium' },
  { id: 'email', label: 'Email', cell: (c) => c.email, sortValue: (c) => c.email },
  { id: 'phone', label: 'Téléphone', cell: (c) => c.phone, sortValue: (c) => c.phone },
  { id: 'address', label: 'Adresse', cell: (c) => c.address, sortValue: (c) => c.address },
];

const columnIds = columns.map((c) => c.id);

export default function ClientsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { runBulk, isRunning } = useBulkAction();
  const tablePrefs = useTablePrefs('clients', columnIds);

  useClearSelectionOnOutsideClick(cardRef, !dialogOpen && !deleteDialogOpen, () => setSelectedIds(new Set()));

  const fetchClients = useCallback(() => api.getClients(), []);
  const { data: rawClients, isLoading, refetch } = useApiCollection(fetchClients);
  const clients: Client[] = useMemo(() => (rawClients || []).map(clientFromApi), [rawClients]);

  const selectedClients = useMemo(
    () => clients.filter((c) => selectedIds.has(c.id)),
    [clients, selectedIds]
  );
  const singleSelected = selectedClients.length === 1 ? selectedClients[0] : null;

  const handleAdd = () => {
    setEditingClient(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const toDelete = selectedClients;
    setDeleteDialogOpen(false);
    await runBulk({
      items: toDelete,
      getName: (c) => c.name,
      action: (c) => api.deleteClient(c.id),
      successLabel: (n) => `${n} client${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}`,
      failureTitle: 'Suppression impossible',
    });
    setSelectedIds(new Set());
    refetch();
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
        <Card>
          <CardHeader><CardTitle>Tous les clients</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card ref={cardRef} className="animate-in fade-in zoom-in-[0.98] duration-300 ease-out">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>
              Tous les clients
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedClients.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedClients.length} sélectionné{selectedClients.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedClients.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn('h-8 w-8 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]', singleSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                      onClick={() => singleSelected && handleEdit(singleSelected)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Modifier</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={isRunning}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer {selectedClients.length > 1 ? `(${selectedClients.length})` : ''}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer la sélection</TooltipContent>
                </Tooltip>
              </div>
              <ResetSortButton visible={tablePrefs.userSort !== null} onClick={tablePrefs.resetPrefs} />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              prefs={tablePrefs}
              columns={columns}
              rows={clients}
              getRowId={(c) => c.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowDoubleClick={handleEdit}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Vous n'avez pas encore de clients.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Commencez par en créer un.
                    </p>
                    <Button onClick={handleAdd}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Ajouter un client
                    </Button>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedClients.length > 1 ? `Supprimer ${selectedClients.length} clients ?` : 'Supprimer ce client ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedClients.length > 1
                ? `Cette action est irréversible. Les ${selectedClients.length} clients sélectionnés seront définitivement supprimés.`
                : `Cette action est irréversible. Le client "${selectedClients[0]?.name ?? ''}" sera définitivement supprimé.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
