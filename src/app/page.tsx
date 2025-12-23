'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Product, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { InventoryTable } from '@/components/dashboard/inventory-table';
import { ArticleDialog } from '@/components/article-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const firestore = useFirestore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Product | undefined>();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } =
    useCollection<Supplier>(suppliersRef);

  const articlesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: articles, isLoading: isLoadingArticles } =
    useCollection<Product>(articlesRef);

  const isLoading = isLoadingSuppliers || isLoadingArticles;

  const handleEdit = (article: Product) => {
    setEditingArticle(article);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Tableau de bord"
        description="Un aperçu de votre inventaire et de vos niveaux de stock."
      />
      {isLoading ? (
         <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <StatsCards articles={articles || []} />
      )}
      
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <InventoryTable 
          articles={articles || []} 
          suppliers={suppliers || []}
          onRowDoubleClick={handleEdit}
        />
      )}
      <ArticleDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editingArticle}
      />
    </div>
  );
}
