'use client';

import { useState, useMemo } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Article, PurchaseOrder, PurchaseReceipt, PurchaseInvoice } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ArticleDialog } from '@/components/article-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function ArticlesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const articlesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: articles, isLoading: isLoadingArticles } = useCollection<Article>(articlesRef);

  const purchaseOrdersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(purchaseOrdersRef);
    
  const purchaseReceiptsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseReceipts') : null),
    [firestore]
  );
  const { data: purchaseReceipts } = useCollection<PurchaseReceipt>(purchaseReceiptsRef);
  
  const purchaseInvoicesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseInvoices') : null),
    [firestore]
  );
  const { data: purchaseInvoices } = useCollection<PurchaseInvoice>(purchaseInvoicesRef);

  const isLoading = isLoadingArticles || !purchaseOrders || !purchaseReceipts || !purchaseInvoices;

  const lastArticleCodeNumber = useMemo(() => {
    if (!articles || articles.length === 0) {
      return 0;
    }
    return articles.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'ART0').replace('ART', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [articles]);


  const handleAdd = () => {
    setEditingArticle(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (article: Article) => {
    setArticleToDelete(article);
    setDeleteDialogOpen(true);
  };
  
  const handleSelectArticle = (article: Article) => {
    if (selectedArticle?.id === article.id) {
      setSelectedArticle(null); // Deselect if clicking the same row
    } else {
      setSelectedArticle(article);
    }
  };
  
  const handleDeleteConfirm = () => {
    if (!firestore || !articleToDelete) return;

    const isArticleInUse = (purchaseOrders || []).some(order => order.items.some(item => item.productId === articleToDelete.id)) ||
                           (purchaseReceipts || []).some(receipt => receipt.items.some(item => item.productId === articleToDelete.id)) ||
                           (purchaseInvoices || []).some(invoice => invoice.items.some(item => item.productId === articleToDelete.id));

    if (isArticleInUse) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: `L'article "${articleToDelete.name}" est utilisé dans des bons de commande, de réception ou des factures et ne peut pas être supprimé.`,
        duration: 5000,
      });
      setDeleteDialogOpen(false);
      return;
    }

    const articleDocRef = doc(firestore, 'products', articleToDelete.id);
    deleteDocumentNonBlocking(articleDocRef);
    toast({
      title: 'Article supprimé',
      description: `L'article "${articleToDelete.name}" a été supprimé.`,
    });
    setDeleteDialogOpen(false);
    setArticleToDelete(null);
    setSelectedArticle(null);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Articles"
        description="Gérez votre inventaire d'articles."
      >
        <Button onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un article
        </Button>
      </PageHeader>
      
      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Tous les articles</CardTitle></CardHeader>
          <CardContent className='space-y-2'>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tous les articles</CardTitle>
            {selectedArticle ? (
              <div className='flex items-center gap-2'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(selectedArticle)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modifier</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteRequest(selectedArticle)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Supprimer</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer</TooltipContent>
                  </Tooltip>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(articles || []).map((article) => (
                  <TableRow
                    key={article.id}
                    onClick={() => handleSelectArticle(article)}
                    onDoubleClick={() => handleEdit(article)}
                    className={cn("cursor-pointer", selectedArticle?.id === article.id && 'bg-muted/50')}
                  >
                    <TableCell className="font-medium">{article.code}</TableCell>
                    <TableCell>{article.name}</TableCell>
                    <TableCell className="text-right">
                      {article.stockLevel}
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(article.price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ArticleDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editingArticle}
        lastArticleCodeNumber={lastArticleCodeNumber}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet article ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'article "{articleToDelete?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
