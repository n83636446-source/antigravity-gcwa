'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

import { useApiCollection } from '@/hooks/use-api';
import { api } from '@/lib/api';
import {
  Product as Article,
  PurchaseOrder,
  PurchaseReceipt,
  PurchaseInvoice,
  ArticleFamily,
  productFromApi,
  purchaseOrderFromApi,
  purchaseReceiptFromApi,
  purchaseInvoiceFromApi,
} from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ArticleDialog } from '@/components/article-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function ArticlesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Clear selection on any click outside the card
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      // Don't clear selection if a dialog is open!
      if (dialogOpen || deleteDialogOpen) return;
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        // Also don't clear if clicking on a tooltip or portal
        if ((e.target as Element).closest('[role="dialog"], [role="tooltip"]')) return;
        setSelectedIds(new Set());
        lastClickedIndexRef.current = null;
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [dialogOpen, deleteDialogOpen]);


  const fetchArticles = useCallback(() => api.getProducts(), []);
  const fetchFamilies = useCallback(() => api.getArticleFamilies(), []);
  const fetchPurchaseOrders = useCallback(() => api.getPurchaseOrders(), []);
  const fetchPurchaseReceipts = useCallback(() => api.getPurchaseReceipts(), []);
  const fetchPurchaseInvoices = useCallback(() => api.getPurchaseInvoices(), []);

  const { data: rawArticles, isLoading: isLoadingArticles, refetch: refetchArticles } = useApiCollection(fetchArticles);
  const { data: families, isLoading: isLoadingFamilies } = useApiCollection<ArticleFamily>(fetchFamilies);
  const { data: rawPurchaseOrders } = useApiCollection(fetchPurchaseOrders);
  const { data: rawPurchaseReceipts } = useApiCollection(fetchPurchaseReceipts);
  const { data: rawPurchaseInvoices } = useApiCollection(fetchPurchaseInvoices);

  const articles: Article[] = (rawArticles || []).map(productFromApi);
  const purchaseOrders: PurchaseOrder[] = (rawPurchaseOrders || []).map(purchaseOrderFromApi);
  const purchaseReceipts: PurchaseReceipt[] = (rawPurchaseReceipts || []).map(purchaseReceiptFromApi);
  const purchaseInvoices: PurchaseInvoice[] = (rawPurchaseInvoices || []).map(purchaseInvoiceFromApi);

  const isLoading = isLoadingArticles || isLoadingFamilies;

  const sortedArticles = useMemo(() => {
    if (!articles) return [];
    return [...articles].sort((a, b) => {
      const getVal = (code?: string) => {
        if (!code) return 999999;
        const digits = code.replace(/\D/g, '');
        return digits ? parseInt(digits, 10) : 999999;
      };
      return getVal(a.code) - getVal(b.code);
    });
  }, [articles]);

  const getFamilyName = (familyId?: string) => {
    if (!familyId || !families) return 'N/A';
    return families.find((f) => f.id === familyId)?.name ?? 'Inconnu';
  };

  const selectedArticles = sortedArticles.filter((a) => selectedIds.has(a.id));
  const singleSelected = selectedArticles.length === 1 ? selectedArticles[0] : null;

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  };

  const handleRowClick = (article: Article, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedIndexRef.current !== null) {
      const from = Math.min(lastClickedIndexRef.current, index);
      const to = Math.max(lastClickedIndexRef.current, index);
      const rangeIds = sortedArticles.slice(from, to + 1).map((a) => a.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(article.id)) next.delete(article.id);
        else next.add(article.id);
        return next;
      });
      lastClickedIndexRef.current = index;
    }
  };

  const handleAdd = () => { setEditingArticle(undefined); setDialogOpen(true); };
  const handleEdit = (article: Article) => { setEditingArticle(article); setDialogOpen(true); };

  const handleDeleteConfirm = async () => {
    const usedIds = new Set<string>();
    [
      ...(purchaseOrders || []).flatMap((o) => o.items.map((i) => i.productId)),
      ...(purchaseReceipts || []).flatMap((r) => r.items.map((i) => i.productId)),
      ...(purchaseInvoices || []).flatMap((inv) => inv.items.map((i) => i.productId)),
    ].forEach((id) => { if (selectedIds.has(id)) usedIds.add(id); });

    if (usedIds.size > 0) {
      const blockedNames = selectedArticles.filter((a) => usedIds.has(a.id)).map((a) => `"${a.name}"`).join(', ');
      toast({ variant: 'destructive', title: 'Suppression impossible', description: `Ces articles sont utilises dans des documents : ${blockedNames}`, duration: 6000 });
      setDeleteDialogOpen(false);
      return;
    }

    let successCount = 0, failCount = 0;
    let lastError = '';
    await Promise.all(
      selectedArticles.map(async (article) => {
        try { await api.deleteProduct(article.id); successCount++; }
        catch(e: any) { console.error('DELETE ERROR:', e); failCount++; lastError = e.message; }
      })
    );

    toast(successCount > 0
      ? { title: `${successCount} article(s) supprime(s)`, description: failCount > 0 ? `${failCount} echec(s): ${lastError}` : undefined }
      : { variant: 'destructive', title: 'Erreur', description: `Impossible de supprimer les articles: ${lastError}` }
    );

    clearSelection();
    setDeleteDialogOpen(false);
    refetchArticles();
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader title="Articles" description="Gerez votre inventaire d articles.">
        <Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" />Ajouter un article</Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Tous les articles</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card ref={cardRef} className="animate-in fade-in zoom-in-[0.98] duration-300 ease-out">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>
              Tous les articles
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className={cn(
              'flex items-center gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
              selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Supprimer {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer la selection</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {sortedArticles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Famille</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedArticles.map((article, index) => (
                    <TableRow
                      key={article.id}
                      onClick={(e) => handleRowClick(article, index, e)}
                      onDoubleClick={() => handleEdit(article)}
                      className={cn(
                        'cursor-pointer select-none transition-colors duration-150 ease-out',
                        selectedIds.has(article.id)
                          ? 'bg-sky-500/10 hover:bg-sky-500/20'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <TableCell className="font-medium">{article.code}</TableCell>
                      <TableCell>{article.name}</TableCell>
                      <TableCell>{getFamilyName(article.familyId)}</TableCell>
                      <TableCell className="text-right">{article.stockLevel}</TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(article.price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}

      <ArticleDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) refetchArticles(); }}
        article={editingArticle}
        articles={articles}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedIds.size > 1 ? `Supprimer ${selectedIds.size} articles ?` : 'Supprimer cet article ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size > 1
                ? `Cette action est irreversible. Les ${selectedIds.size} articles selectionnes seront definitivement supprimes.`
                : `Cette action est irreversible. L article "${selectedArticles[0]?.name}" sera definitivement supprime.`}
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
