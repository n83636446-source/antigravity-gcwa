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
import { DraggableHeader } from './ui/DraggableHeader';
import { ReactNode } from 'react';

type Column = {
    id: keyof Supplier | 'address';
    label: string;
};

type SuppliersTableProps = {
  suppliers: Supplier[];
  onRowClick: (supplier: Supplier) => void;
  onRowDoubleClick: (supplier: Supplier) => void;
  selectedSupplierId?: string | null;
  columns: Column[];
  columnIds: (keyof Supplier | 'address')[];
};

export function SuppliersTable({
  suppliers,
  onRowClick,
  onRowDoubleClick,
  selectedSupplierId,
  columns,
  columnIds,
}: SuppliersTableProps) {

  const renderCellContent = (supplier: Supplier, columnId: Column['id']): ReactNode => {
    const key = `${supplier.id}-${columnId}`;
    switch (columnId) {
      case 'code':
        return <TableCell key={key} className="font-medium">{supplier.code}</TableCell>;
      case 'name':
        return <TableCell key={key}>{supplier.name}</TableCell>;
      case 'ice':
        return <TableCell key={key}>{supplier.ice}</TableCell>;
      case 'address':
        return <TableCell key={key}>{`${supplier.street}, ${supplier.city}, ${supplier.country}`}</TableCell>;
      case 'contactName':
        return <TableCell key={key}>{supplier.contactName}</TableCell>;
      case 'contactEmail':
        return <TableCell key={key}>{supplier.contactEmail}</TableCell>;
      case 'contactPhone':
        return <TableCell key={key}>{supplier.contactPhone}</TableCell>;
      default:
        return <TableCell key={key}></TableCell>;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map(({ id, label }) => (
            <DraggableHeader key={id} id={id}>
              {label}
            </DraggableHeader>
          ))}
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
            {columnIds.map((columnId) => renderCellContent(supplier, columnId))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
