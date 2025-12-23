'use client';

import * as React from 'react';
import type { Product, Supplier } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EstimateStockDialog } from './estimate-stock-dialog';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type InventoryTableProps = {
  articles: Product[];
  suppliers: Supplier[];
  onRowDoubleClick?: (article: Product) => void;
};

export function InventoryTable({ articles, suppliers, onRowDoubleClick }: InventoryTableProps) {
  const getStockStatus = (article: Product) => {
    if (article.stockLevel === 0) {
      return {
        label: 'En rupture',
        variant: 'destructive',
        icon: <XCircle className="mr-2 h-4 w-4" />,
      } as const;
    }
    if (article.stockLevel <= article.reorderThreshold) {
      return {
        label: 'Stock faible',
        variant: 'secondary',
        icon: <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />,
      } as const;
    }
    return {
      label: 'En stock',
      variant: 'default',
      icon: <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />,
    } as const;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventaire actuel</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Prix</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => {
              const status = getStockStatus(article);
              const supplier = suppliers.find((s) => s.id === article.supplierId);
              return (
                <TableRow 
                  key={article.id}
                  onDoubleClick={() => onRowDoubleClick?.(article)}
                  className={onRowDoubleClick ? "cursor-pointer" : ""}
                >
                  <TableCell className="font-medium">{article.name}</TableCell>
                  <TableCell className="text-right">{article.stockLevel}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="items-center">
                      {status.icon}
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(article.price)}
                  </TableCell>
                  <TableCell className="text-center">
                    {status.label === 'Stock faible' && supplier && (
                      <EstimateStockDialog article={article} supplier={supplier} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
