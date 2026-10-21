'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { ArticleDialog } from '@/components/article-dialog';
import { Product as Article, ArticleFamily, productFromApi } from '@/lib/types';
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

const priceFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const codeNumber = (a: Article): number | null => {
  const digits = String(a.code ?? '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

const columnIds = ['code', 'name', 'family', 'stock', 'price'];

export default function ArticlesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { runBulk, isRunning } = useBulkAction();
  const tablePrefs = useTablePrefs('articles', columnIds);

  useClearSelectionOnOutsideClick(cardRef, !dialogOpen && !deleteDialogOpen, () => setSelectedIds(new Set()));

  const fetchArticles = useCallback(() => api.getProducts(), []);
  const fetchFamilies = useCallback(() => api.getArticleFamilies(), []);

  const { data: rawArticles, isLoading: isLoadingArticles, refetch } = useApiCollection(fetchArticles);
  const { data: families, isLoading: isLoadingFamilies } = useApiCollection<ArticleFamily>(fetchFamilies);

  const articles: Article[] = useMemo(() => (rawArticles || []).map(productFromApi), [rawArticles]);
  const isLoading = isLoadingArticles || isLoadingFamilies;

  const familyNameById = useMemo(
    () => new Map((families || []).map((f) => [f.id, f.name])),
    [families]
  );

  const columns: DataTableColumn<Article>[] = useMemo(
    () => [
      { id: 'code', label: 'Code', cell: (a) => a.code, sortValue: codeNumber, className: 'font-medium' },
      { id: 'name', label: 'Nom', cell: (a) => a.name, sortValue: (a) => a.name },
      {
        id: 'family',
        label: 'Famille',
        cell: (a) => (!a.familyId ? 'N/A' : familyNameById.get(a.familyId) ?? 'Inconnu'),
        sortValue: (a) => (a.familyId ? familyNameById.get(a.familyId) ?? null : null),
      },
      {
        id: 'stock',
        label: 'Stock',
        cell: (a) => a.stockLevel,
        sortValue: (a) => a.stockLevel,
        className: 'text-right',
        headClassName: 'text-right',
      },
      {
        id: 'price',
        label: 'Prix',
        cell: (a) => priceFormatter.format(a.price),
        sortValue: (a) => a.price,
        className: 'text-right',
        headClassName: 'text-right',
      },
    ],
    [familyNameById]
  );

  const selectedArticles = useMemo(
    () => articles.filter((a) => selectedIds.has(a.id)),
    [articles, selectedIds]
  );
  const singleSelected = selectedArticles.length === 1 ? selectedArticles[0] : null;

  const handleAdd = () => {
    setEditingArticle(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const toDelete = selectedArticles;
    setDeleteDialogOpen(false);
    await runBulk({
      items: toDelete,
      getName: (a) => a.name,
      action: (a) => api.deleteProduct(a.id),
      successLabel: (n) => `${n} article${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}`,
      failureTitle: 'Suppression impossible',
    });
    setSelectedIds(new Set());
    refetch();
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader title="Articles" description="Gérez votre inventaire d'articles.">
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un article
        </Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Tous les articles</CardTitle></CardHeader>
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
              Tous les articles
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedArticles.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedArticles.length} sélectionné{selectedArticles.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedArticles.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                      Supprimer {selectedArticles.length > 1 ? `(${selectedArticles.length})` : ''}
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
              rows={articles}
              getRowId={(a) => a.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowDoubleClick={handleEdit}
              defaultSort={{ columnId: 'code', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Vous n'avez pas encore d'articles.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Commencez par en créer un.
                    </p>
                    <Button onClick={handleAdd}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Ajouter un article
                    </Button>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      <ArticleDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) refetch();
        }}
        article={editingArticle}
        articles={articles}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedArticles.length > 1 ? `Supprimer ${selectedArticles.length} articles ?` : 'Supprimer cet article ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedArticles.length > 1
                ? `Cette action est irréversible. Les ${selectedArticles.length} articles sélectionnés seront définitivement supprimés.`
                : `Cette action est irréversible. L'article "${selectedArticles[0]?.name ?? ''}" sera définitivement supprimé.`}
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
    </div>
  );
}
