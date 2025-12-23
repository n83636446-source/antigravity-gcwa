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
  onRowDoubleClick: (supplier: Supplier) => void;
};

export function SuppliersTable({
  suppliers,
  onRowDoubleClick,
}: SuppliersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tous les fournisseurs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom de l'entreprise</TableHead>
              <TableHead>ICE</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Personne à contacter</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow
                key={supplier.id}
                onDoubleClick={() => onRowDoubleClick(supplier)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{supplier.code}</TableCell>
                <TableCell>{supplier.name}</TableCell>
                <TableCell>{supplier.ice}</TableCell>
                <TableCell>{`${supplier.street}, ${supplier.city}, ${supplier.country}`}</TableCell>
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
