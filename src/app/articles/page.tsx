'use client';

import { useMemo, useState } from 'react';
import { collection, collectionGroup, query, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Product as Article, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ArticleDialog } from '@/components/article-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil } from 'lucide-react';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

export default function ArticlesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();

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

  const isLoading = isLoadingSuppliers || isLoadingArticles;

  const handleAdd = () => {
    setEditingArticle(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setDialogOpen(true);
  };

  const handleDelete = (article: Article) => {
    if (!firestore) return;
    const articleDocRef = doc(
      firestore,
      'suppliers',
      article.supplierId,
      'products',
      article.id
    );
    deleteDocumentNonBlocking(articleDocRef);
    toast({
      title: 'Article supprimé',
      description: `L'article "${article.name}" a été supprimé.`,
    });
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
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tous les articles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell className="font-medium">{article.name}</TableCell>
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
                       <Button variant="ghost" size="icon" onClick={() => handleEdit(article)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
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
      />
    </div>
  );
}
