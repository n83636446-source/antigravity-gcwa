import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DollarSign, Package, AlertCircle } from 'lucide-react';
import type { Article } from '@/lib/types';

type StatsCardsProps = {
  articles: Article[];
};

export function StatsCards({ articles }: StatsCardsProps) {
  const stats = useMemo(() => {
    const totalValue = articles.reduce(
      (acc, article) => acc + article.price * article.stock,
      0
    );
    const lowStockItems = articles.filter(
      (p) => p.stock <= p.lowStockThreshold && p.stock > 0
    ).length;
    const totalArticles = articles.length;
    return { totalValue, lowStockItems, totalArticles };
  }, [articles]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valeur totale de l'inventaire</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            }).format(stats.totalValue)}
          </div>
          <p className="text-xs text-muted-foreground">
            Valeur estimée de tous les articles en stock
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Articles totaux</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalArticles}</div>
          <p className="text-xs text-muted-foreground">
            Nombre d'articles uniques
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Articles en stock faible</CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.lowStockItems}</div>
          <p className="text-xs text-muted-foreground">
            Articles nécessitant un réapprovisionnement bientôt
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
