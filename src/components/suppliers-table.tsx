'use client';

import type { Supplier } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type SuppliersTableProps = {
  suppliers: Supplier[];
};

export function SuppliersTable({ suppliers }: SuppliersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Suppliers</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.contactName}</TableCell>
                <TableCell>{supplier.contactEmail}</TableCell>
                <TableCell>{supplier.contactPhone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
