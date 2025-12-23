'use client';

import { PageHeader } from '@/components/page-header';
import { StockLevelChart } from '@/components/reports/stock-level-chart';
import { SalesTrendsChart } from '@/components/reports/sales-trends-chart';
import { salesData } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsPage() {
  const firestore = useFirestore();

  const articlesQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'products')) : null),
    [firestore]
  );
  const { data: articles, isLoading: isLoadingArticles } =
    useCollection<Product>(articlesQuery);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Rapports & Analyses"
        description="Visualisez vos données d'inventaire et de ventes."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tendances des ventes</CardTitle>
            <CardDescription>
              Comparaison des ventes entre cette année et l'année dernière.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendsChart data={salesData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Niveaux de stock</CardTitle>
            <CardDescription>
              Niveaux de stock actuels de tous les produits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingArticles ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <StockLevelChart data={articles || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
