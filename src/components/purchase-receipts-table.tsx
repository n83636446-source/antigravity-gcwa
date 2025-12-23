'use client';

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import type {
  PurchaseReceipt,
  PurchaseOrder,
  Supplier,
} from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableHeader } from '@/components/ui/DraggableHeader';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

type EnrichedReceipt = PurchaseReceipt & {
  orderNumber?: string;
  supplierName: string;
  formattedDate: string;
}

type Column = {
  id: keyof EnrichedReceipt | 'orderNumber' | 'supplierName' | 'formattedDate' | 'status';
  label: string;
};

const initialColumns: Column[] = [
    { id: 'receiptNumber', label: 'Numéro BR' },
    { id: 'orderNumber', label: 'Numéro BC' },
    { id: 'supplierName', label: 'Fournisseur' },
    { id: 'formattedDate', label: 'Date de réception' },
    { id: 'status', label: 'Statut' },
];


type PurchaseReceiptsTableProps = {
  receipts: PurchaseReceipt[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  onRowClick: (receipt: PurchaseReceipt) => void;
  onRowDoubleClick: (receipt: PurchaseReceipt) => void;
  selectedReceiptId?: string | null;
};

export function PurchaseReceiptsTable({
  receipts,
  purchaseOrders,
  suppliers,
  onRowClick,
  onRowDoubleClick,
  selectedReceiptId,
}: PurchaseReceiptsTableProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  useEffect(() => {
    try {
      const savedColumns = localStorage.getItem('purchaseReceiptsColumns');
      if (savedColumns) {
        const parsedColumns: Column[] = JSON.parse(savedColumns);
        // Add new 'status' column if it's not there for backward compatibility
        const columnIds = new Set(parsedColumns.map(c => c.id));
        if (!columnIds.has('status')) {
          parsedColumns.push({ id: 'status', label: 'Statut' });
        }
        // Basic validation
        if (parsedColumns.length > 0) {
            setColumns(parsedColumns);
        } else {
            setColumns(initialColumns);
        }
      }
    } catch (error) {
      console.error("Failed to load or parse columns from localStorage", error);
      setColumns(initialColumns);
    }
  }, []);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = columnIds.indexOf(active.id as any);
        const newIndex = columnIds.indexOf(over.id as any);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        try {
          localStorage.setItem('purchaseReceiptsColumns', JSON.stringify(newOrder));
        } catch (error) {
          console.error("Failed to save columns to localStorage", error);
        }
        return newOrder;
      });
    }
  }

  const enrichedReceipts = useMemo(() => {
    return (receipts || []).map(receipt => {
      let orderNumber: string | undefined = 'N/A';
      const supplier = suppliers.find((s) => s.id === receipt.supplierId);
      
      if (receipt.purchaseOrderId) {
          const order = purchaseOrders.find((o) => o.id === receipt.purchaseOrderId);
          orderNumber = order?.orderNumber;
      }
      
      return {
        ...receipt,
        orderNumber,
        supplierName: supplier?.name ?? 'Inconnu',
        formattedDate: format(new Date(receipt.receiptDate), 'dd/MM/yyyy', { locale: fr }),
      };
    }).sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime());
  }, [receipts, purchaseOrders, suppliers]);
  
  const getStatusVariant = (status: PurchaseReceipt['status']) => {
    return status === 'Brouillon' ? 'secondary' : 'default';
  };
  
  const renderCellContent = (receipt: any, columnId: Column['id']) => {
    const key = `${receipt.id}-${columnId}`;
    switch (columnId) {
      case 'receiptNumber':
        return <TableCell key={key} className="font-medium">{receipt.receiptNumber}</TableCell>;
      case 'orderNumber':
        return <TableCell key={key}>{receipt.orderNumber}</TableCell>;
      case 'supplierName':
        return <TableCell key={key}>{receipt.supplierName}</TableCell>;
      case 'formattedDate':
        return <TableCell key={key}>{receipt.formattedDate}</TableCell>;
      case 'status':
        return <TableCell key={key}><Badge variant={getStatusVariant(receipt.status)}>{receipt.status}</Badge></TableCell>;
      default:
        return <TableCell key={key}></TableCell>;
    }
  };


  return (
    <>
        {receipts.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
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
                  {enrichedReceipts.map((receipt) => (
                    <TableRow 
                      key={receipt.id}
                      onClick={() => onRowClick(receipt)}
                      onDoubleClick={() => onRowDoubleClick(receipt)}
                      className={cn("cursor-pointer", selectedReceiptId === receipt.id && 'bg-muted/50')}
                    >
                      {columnIds.map((columnId) => renderCellContent(receipt, columnId))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">
                Vous n'avez pas encore de bons de réception.
              </h3>
              <p className="text-sm text-muted-foreground">
                Commencez par en créer un.
              </p>
            </div>
          </div>
        )}
    </>
  );
}
