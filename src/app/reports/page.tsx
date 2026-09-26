'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { StockLevelChart } from '@/components/reports/stock-level-chart';
import { SalesTrendsChart } from '@/components/reports/sales-trends-chart';
import { api, type ApiSalesData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useApiCollection } from '@/hooks/use-api';
import { Product, productFromApi } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsPage() {
  const [salesData, setSalesData] = useState<ApiSalesData[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);

  useEffect(() => {
    api.getSalesData()
      .then(setSalesData)
      .catch(console.error)
      .finally(() => setIsLoadingSales(false));
  }, []);

  const fetchProducts = useCallback(() => api.getProducts(), []);
  const { data: rawArticles, isLoading: isLoadingArticles } = useApiCollection(fetchProducts);
  const articles: Product[] = (rawArticles || []).map(productFromApi);


  const formattedSalesData = salesData.map(d => ({
    month: d.month,
    "Cette Année": d.this_year,
    "Année Dernière": d.last_year,
  }));

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
            {isLoadingSales ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <SalesTrendsChart data={formattedSalesData} />
            )}
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
