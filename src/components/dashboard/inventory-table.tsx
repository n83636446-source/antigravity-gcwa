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
  products: Product[];
  suppliers: Supplier[];
};

export function InventoryTable({ products, suppliers }: InventoryTableProps) {
  const getStockStatus = (product: Product) => {
    if (product.stock === 0) {
      return {
        label: 'Out of Stock',
        variant: 'destructive',
        icon: <XCircle className="mr-2 h-4 w-4" />,
      } as const;
    }
    if (product.stock <= product.lowStockThreshold) {
      return {
        label: 'Low Stock',
        variant: 'secondary',
        icon: <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />,
      } as const;
    }
    return {
      label: 'In Stock',
      variant: 'default',
      icon: <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />,
    } as const;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const status = getStockStatus(product);
              const supplier = suppliers.find((s) => s.id === product.supplierId);
              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-right">{product.stock}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="items-center">
                      {status.icon}
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(product.price)}
                  </TableCell>
                  <TableCell className="text-center">
                    {status.label === 'Low Stock' && supplier && (
                      <EstimateStockDialog product={product} supplier={supplier} />
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
