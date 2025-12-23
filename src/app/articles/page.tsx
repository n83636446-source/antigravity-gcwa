'use client';

import { useState, useMemo } from 'react';
import { collection, collectionGroup, query, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Product as Article, Supplier } from '@/lib/types';
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

export default function ArticlesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );

  const { data: suppliers, isLoading: isLoadingSuppliers } =
    useCollection<Supplier>(suppliersRef);

  const articlesQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'products')) : null),
    [firestore]
  );
  const { data: articles, isLoading: isLoadingArticles } =
    useCollection<Article>(articlesQuery);
    
  const lastArticleCodeNumber = useMemo(() => {
    if (!articles || articles.length === 0) {
      return 0;
    }
    return articles.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'ART0').replace('ART', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [articles]);


  const isLoading = isLoadingSuppliers || isLoadingArticles;

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

  const handleDeleteConfirm = () => {
    if (!firestore || !articleToDelete) return;
    const articleDocRef = doc(
      firestore,
      'suppliers',
      articleToDelete.supplierId,
      'products',
      articleToDelete.id
    );
    deleteDocumentNonBlocking(articleDocRef);
    toast({
      title: 'Article supprimé',
      description: `L'article "${articleToDelete.name}" a été supprimé.`,
    });
    setDeleteDialogOpen(false);
    setArticleToDelete(null);
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers?.find((s) => s.id === supplierId)?.name || 'Inconnu';
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
          <CardHeader>
            <CardTitle>Tous les articles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(articles || []).map((article) => (
                  <TableRow
                    key={article.id}
                    onDoubleClick={() => handleEdit(article)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{article.code}</TableCell>
                    <TableCell>{article.name}</TableCell>
                    <TableCell>{getSupplierName(article.supplierId)}</TableCell>
                    <TableCell className="text-right">
                      {article.stockLevel}
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(article.price)}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(article);}}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteRequest(article);}}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Supprimer</span>
                        </Button>
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
        suppliers={suppliers || []}
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

    