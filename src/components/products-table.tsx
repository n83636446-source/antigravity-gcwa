'use client';

import type { Product, Supplier } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type ProductsTableProps = {
  products: Product[];
  suppliers: Supplier[];
};

export function ProductsTable({ products, suppliers }: ProductsTableProps) {
  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Products</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{getSupplierName(product.supplierId)}</TableCell>
                <TableCell className="text-right">{product.stock}</TableCell>
                <TableCell className="text-right">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(product.price)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
