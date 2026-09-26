'use client';

import { useState, useCallback } from 'react';
import { useApiCollection } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { Product, Supplier, productFromApi, supplierFromApi } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { InventoryTable } from '@/components/dashboard/inventory-table';
import { ArticleDialog } from '@/components/article-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Product | undefined>();

  const fetchSuppliers = useCallback(() => api.getSuppliers(), []);
  const fetchProducts = useCallback(() => api.getProducts(), []);

  const { data: rawSuppliers, isLoading: isLoadingSuppliers } = useApiCollection(fetchSuppliers);
  const { data: rawArticles, isLoading: isLoadingArticles, refetch: refetchArticles } = useApiCollection(fetchProducts);

  const suppliers: Supplier[] = (rawSuppliers || []).map(supplierFromApi);
  const articles: Product[] = (rawArticles || []).map(productFromApi);

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
        <StatsCards articles={articles} />
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <InventoryTable
          articles={articles}
          suppliers={suppliers}
          onRowDoubleClick={handleEdit}
        />
      )}
      <ArticleDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) refetchArticles();
        }}
        article={editingArticle}
        articles={articles}
      />
    </div>
  );
}

