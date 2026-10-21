'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { useApiCollection } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { ArticleFamily } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArticleFamilyDialog } from '@/components/article-family-dialog';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { useBulkAction } from '@/hooks/use-bulk-action';
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

const columns: DataTableColumn<ArticleFamily>[] = [
  { id: 'code', label: 'Code', cell: (f) => f.code, sortValue: (f) => f.code, className: 'font-medium' },
  { id: 'name', label: 'Nom', cell: (f) => f.name, sortValue: (f) => f.name },
];

const columnIds = columns.map((c) => c.id);

export default function ArticleFamiliesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ArticleFamily | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { runBulk, isRunning } = useBulkAction();
  const tablePrefs = useTablePrefs('article-families', columnIds);

  useClearSelectionOnOutsideClick(cardRef, !isDialogOpen && !deleteDialogOpen, () => setSelectedIds(new Set()));

  const fetchFamilies = useCallback(() => api.getArticleFamilies(), []);
  const { data: families, isLoading, refetch } = useApiCollection<ArticleFamily>(fetchFamilies);

  const selectedFamilies = useMemo(
    () => (families || []).filter((f) => selectedIds.has(f.id)),
    [families, selectedIds]
  );
  const singleSelected = selectedFamilies.length === 1 ? selectedFamilies[0] : null;

  const handleAddFamily = () => {
    setEditingFamily(undefined);
    setIsDialogOpen(true);
  };

  const handleEditFamily = (family: ArticleFamily) => {
    setEditingFamily(family);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const toDelete = selectedFamilies;
    setDeleteDialogOpen(false);
    await runBulk({
      items: toDelete,
      getName: (f) => f.name,
      action: (f) => api.deleteArticleFamily(f.id),
      successLabel: (n) => `${n} famille${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}`,
      failureTitle: 'Suppression impossible',
    });
    setSelectedIds(new Set());
    refetch();
  };

  const lastFamilyCodeNumber = useMemo(() => {
    if (!families || families.length === 0) {
      return 0;
    }
    return families.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'FAM0').replace('FAM', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [families]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Familles d'articles"
        description="Gérez les catégories de vos articles."
      >
        <Button onClick={handleAddFamily}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter une famille
        </Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Toutes les familles</CardTitle></CardHeader>
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
              Toutes les familles
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedFamilies.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedFamilies.length} sélectionnée{selectedFamilies.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedFamilies.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn('h-8 w-8 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]', singleSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                      onClick={() => singleSelected && handleEditFamily(singleSelected)}
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
                      Supprimer {selectedFamilies.length > 1 ? `(${selectedFamilies.length})` : ''}
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
              rows={families || []}
              getRowId={(f) => f.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowDoubleClick={handleEditFamily}
              defaultSort={{ columnId: 'code', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Vous n'avez pas encore de familles d'articles.
                    </h3>
                    <p className="text-sm text-muted-foreground">Commencez par en créer une.</p>
                    <Button onClick={handleAddFamily} className="mt-4">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer une famille
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
              {selectedFamilies.length > 1 ? `Supprimer ${selectedFamilies.length} familles ?` : 'Supprimer cette famille ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedFamilies.length > 1
                ? `Cette action est irréversible. Les ${selectedFamilies.length} familles sélectionnées seront définitivement supprimées.`
                : `Cette action est irréversible. La famille "${selectedFamilies[0]?.name ?? ''}" sera définitivement supprimée.`}
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

      <ArticleFamilyDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) refetch();
        }}
        family={editingFamily}
        lastFamilyCodeNumber={lastFamilyCodeNumber}
        families={families || []}
      />
    </div>
  );
}
