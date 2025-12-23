'use client';

import { useMemo, useState } from 'react';
import { collection, collectionGroup, query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Article, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ArticlesTable } from '@/components/articles-table';
import { ArticleDialog } from '@/components/article-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function ArticlesPage() {
  const firestore = useFirestore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );

  const { data: suppliers, isLoading: isLoadingSuppliers } =
    useCollection<Supplier>(suppliersRef);

  const articlesQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'articles')) : null),
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
        <ArticlesTable
          articles={articles || []}
          suppliers={suppliers || []}
          onRowDoubleClick={handleEdit}
        />
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
