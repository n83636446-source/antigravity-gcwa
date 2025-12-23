'use client';

import type { Product as Article, Supplier } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArticleActions } from './article-actions';

type ArticlesTableProps = {
  articles: Article[];
  suppliers: Supplier[];
  onEdit: (article: Article) => void;
  onDelete: (article: Article) => void;
  onRowDoubleClick: (article: Article) => void;
};

export function ArticlesTable({
  articles,
  suppliers,
  onEdit,
  onDelete,
  onRowDoubleClick,
}: ArticlesTableProps) {
  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || 'Inconnu';
  };

  return (
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
            {articles.map((article) => (
              <TableRow
                key={article.id}
                onDoubleClick={() => onRowDoubleClick(article)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{article.name}</TableCell>
                <TableCell>{getSupplierName(article.supplierId)}</TableCell>
                <TableCell className="text-right">{article.stockLevel}</TableCell>
                <TableCell className="text-right">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(article.price)}
                </TableCell>
                <TableCell className="text-right">
                    <ArticleActions 
                        article={article}
                        onEdit={() => onEdit(article)}
                        onDelete={() => onDelete(article)}
                    />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
