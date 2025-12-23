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
import { cn } from '@/lib/utils';

type SuppliersTableProps = {
  suppliers: Supplier[];
  onRowClick: (supplier: Supplier) => void;
  onRowDoubleClick: (supplier: Supplier) => void;
  selectedSupplierId?: string | null;
};

export function SuppliersTable({
  suppliers,
  onRowClick,
  onRowDoubleClick,
  selectedSupplierId,
}: SuppliersTableProps) {
  return (
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
            onClick={() => onRowClick(supplier)}
            onDoubleClick={() => onRowDoubleClick(supplier)}
            className={cn(
              "cursor-pointer",
              selectedSupplierId === supplier.id && 'bg-muted/50'
            )}
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
  );
}
