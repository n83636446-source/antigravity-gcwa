'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { RepresentativeDialog } from '@/components/representative-dialog';
import { Representative, representativeFromApi } from '@/lib/types';
import { useApiCollection } from '@/hooks/use-api';
import { useBulkAction } from '@/hooks/use-bulk-action';
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const codeNumber = (r: Representative): number | null => {
  const digits = String(r.code ?? '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

const columns: DataTableColumn<Representative>[] = [
  {
    id: 'code',
    label: 'Code',
    cell: (r) => r.code || '-',
    sortValue: codeNumber,
    className: 'font-mono text-muted-foreground',
    headClassName: 'w-[100px]',
  },
  { id: 'name', label: 'Nom', cell: (r) => r.name, sortValue: (r) => r.name, className: 'font-medium' },
  { id: 'email', label: 'Email', cell: (r) => r.email, sortValue: (r) => r.email },
];

const columnIds = columns.map((c) => c.id);

export default function RepresentativesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [representativeToEdit, setRepresentativeToEdit] = useState<Representative | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { runBulk, isRunning } = useBulkAction();
  const tablePrefs = useTablePrefs('representatives', columnIds);

  useClearSelectionOnOutsideClick(cardRef, !isDialogOpen && !deleteDialogOpen, () => setSelectedIds(new Set()));

  const fetchRepresentatives = useCallback(() => api.getRepresentatives(), []);
  const { data: rawReps, isLoading, refetch } = useApiCollection(fetchRepresentatives);
  const representatives: Representative[] = useMemo(() => (rawReps || []).map(representativeFromApi), [rawReps]);

  // Rows with the same code number (or none) keep a name order, because the table's sort is stable.
  const sortedRepresentatives = useMemo(() => {
    const sorted = [...representatives];
    sorted.sort((a, b) => {
      const getWeight = (r: Representative) => {
        if (!r.code) return Infinity;
        const digits = String(r.code).replace(/[^0-9]/g, '');
        if (!digits) return Infinity;
        const val = parseInt(digits, 10);
        return isNaN(val) ? Infinity : val;
      };
      const weightA = getWeight(a);
      const weightB = getWeight(b);
      if (weightA !== weightB) return weightA - weightB;
      return (a.name || '').localeCompare(b.name || '');
    });
    return sorted;
  }, [representatives]);

  const selectedRepresentatives = useMemo(
    () => representatives.filter((r) => selectedIds.has(r.id)),
    [representatives, selectedIds]
  );
  const singleSelected = selectedRepresentatives.length === 1 ? selectedRepresentatives[0] : null;

  const handleCreate = () => {
    setRepresentativeToEdit(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (representative: Representative) => {
    setRepresentativeToEdit(representative);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const toDelete = selectedRepresentatives;
    setDeleteDialogOpen(false);
    await runBulk({
      items: toDelete,
      getName: (r) => r.name,
      action: (r) => api.deleteRepresentative(r.id),
      successLabel: (n) => `${n} représentant${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}`,
      failureTitle: 'Suppression impossible',
    });
    setSelectedIds(new Set());
    refetch();
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Représentants"
        description="Gérez vos représentants."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau représentant
        </Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Tous les représentants</CardTitle></CardHeader>
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
              Tous les représentants
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedRepresentatives.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedRepresentatives.length} sélectionné{selectedRepresentatives.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedRepresentatives.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                      Supprimer {selectedRepresentatives.length > 1 ? `(${selectedRepresentatives.length})` : ''}
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
              rows={sortedRepresentatives}
              getRowId={(r) => r.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowDoubleClick={handleEdit}
              defaultSort={{ columnId: 'code', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Vous n'avez pas encore de représentants.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer un.
                    </p>
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
              {selectedRepresentatives.length > 1
                ? `Supprimer ${selectedRepresentatives.length} représentants ?`
                : 'Supprimer ce représentant ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRepresentatives.length > 1
                ? `Cette action est irréversible. Les ${selectedRepresentatives.length} représentants sélectionnés seront définitivement supprimés.`
                : `Cette action est irréversible. Le représentant "${selectedRepresentatives[0]?.name ?? ''}" sera définitivement supprimé.`}
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

      {isDialogOpen && (
        <RepresentativeDialog
          isOpen={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) refetch();
          }}
          representative={representativeToEdit}
          representatives={representatives}
        />
      )}
    </div>
  );
}
