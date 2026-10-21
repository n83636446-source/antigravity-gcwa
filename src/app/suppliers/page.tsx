'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { SupplierDialog } from '@/components/supplier-dialog';
import { Supplier, supplierFromApi } from '@/lib/types';
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

const codeNumber = (s: Supplier): number | null => {
  const digits = String(s.code ?? '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

const formatAddress = (s: Supplier): string =>
  [s.street, s.city, s.country].filter(Boolean).join(', ');

const columns: DataTableColumn<Supplier>[] = [
  { id: 'code', label: 'Code', cell: (s) => s.code, sortValue: codeNumber, className: 'font-medium' },
  { id: 'name', label: "Nom de l'entreprise", cell: (s) => s.name, sortValue: (s) => s.name },
  { id: 'ice', label: 'ICE', cell: (s) => s.ice, sortValue: (s) => s.ice },
  { id: 'address', label: 'Adresse', cell: (s) => formatAddress(s), sortValue: (s) => formatAddress(s) },
  { id: 'contactName', label: 'Personne à contacter', cell: (s) => s.contactName, sortValue: (s) => s.contactName },
  { id: 'contactEmail', label: 'Email', cell: (s) => s.contactEmail, sortValue: (s) => s.contactEmail },
  { id: 'contactPhone', label: 'Téléphone', cell: (s) => s.contactPhone, sortValue: (s) => s.contactPhone },
];

const columnIds = columns.map((c) => c.id);

export default function SuppliersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { runBulk, isRunning } = useBulkAction();
  const tablePrefs = useTablePrefs('suppliers', columnIds);

  useClearSelectionOnOutsideClick(cardRef, !dialogOpen && !deleteDialogOpen, () => setSelectedIds(new Set()));

  const fetchSuppliers = useCallback(() => api.getSuppliers(), []);
  const { data: rawSuppliers, isLoading, refetch } = useApiCollection(fetchSuppliers);
  const suppliers: Supplier[] = useMemo(() => (rawSuppliers || []).map(supplierFromApi), [rawSuppliers]);

  const selectedSuppliers = useMemo(
    () => suppliers.filter((s) => selectedIds.has(s.id)),
    [suppliers, selectedIds]
  );
  const singleSelected = selectedSuppliers.length === 1 ? selectedSuppliers[0] : null;

  const handleAdd = () => {
    setEditingSupplier(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const toDelete = selectedSuppliers;
    setDeleteDialogOpen(false);
    await runBulk({
      items: toDelete,
      getName: (s) => s.name,
      action: (s) => api.deleteSupplier(s.id),
      successLabel: (n) => `${n} fournisseur${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}`,
      failureTitle: 'Suppression impossible',
    });
    setSelectedIds(new Set());
    refetch();
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Fournisseurs"
        description="Gérez votre liste de fournisseurs."
      >
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un fournisseur
        </Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Tous les fournisseurs</CardTitle></CardHeader>
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
              Tous les fournisseurs
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedSuppliers.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedSuppliers.length} sélectionné{selectedSuppliers.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedSuppliers.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                      Supprimer {selectedSuppliers.length > 1 ? `(${selectedSuppliers.length})` : ''}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer la sélection</TooltipContent>
                </Tooltip>
              </div>
              <ResetSortButton visible={tablePrefs.isCustomized} onClick={tablePrefs.resetPrefs} />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              prefs={tablePrefs}
              columns={columns}
              rows={suppliers}
              getRowId={(s) => s.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowDoubleClick={handleEdit}
              defaultSort={{ columnId: 'code', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Vous n'avez pas encore de fournisseurs.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Commencez par en créer un.
                    </p>
                    <Button onClick={handleAdd}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Ajouter un fournisseur
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
              {selectedSuppliers.length > 1 ? `Supprimer ${selectedSuppliers.length} fournisseurs ?` : 'Supprimer ce fournisseur ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSuppliers.length > 1
                ? `Cette action est irréversible. Les ${selectedSuppliers.length} fournisseurs sélectionnés seront définitivement supprimés.`
                : `Cette action est irréversible. Le fournisseur "${selectedSuppliers[0]?.name ?? ''}" sera définitivement supprimé.`}
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

      <SupplierDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) refetch();
        }}
        supplier={editingSupplier}
        suppliers={suppliers}
      />
    </div>
  );
}
