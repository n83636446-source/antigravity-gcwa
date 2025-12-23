'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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

type EnrichedReceipt = PurchaseReceipt & {
  orderNumber: string;
  supplierName: string;
  formattedDate: string;
}

type Column = {
  id: keyof EnrichedReceipt | 'orderNumber' | 'supplierName' | 'formattedDate';
  label: string;
};

const initialColumns: Column[] = [
    { id: 'receiptNumber', label: 'Numéro BR' },
    { id: 'orderNumber', label: 'Numéro BC' },
    { id: 'supplierName', label: 'Fournisseur' },
    { id: 'formattedDate', label: 'Date de réception' },
];


type PurchaseReceiptsTableProps = {
  receipts: PurchaseReceipt[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
};

export function PurchaseReceiptsTable({
  receipts,
  purchaseOrders,
  suppliers,
}: PurchaseReceiptsTableProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  useEffect(() => {
    try {
      const savedColumns = localStorage.getItem('purchaseReceiptsColumns');
      if (savedColumns) {
        const parsedColumns: Column[] = JSON.parse(savedColumns);
        const savedColumnIds = new Set(parsedColumns.map(c => c.id));
        const initialColumnIds = new Set(initialColumns.map(c => c.id));
        
        if (parsedColumns.length === initialColumns.length && [...savedColumnIds].every(id => initialColumnIds.has(id))) {
          setColumns(parsedColumns);
        }
      }
    } catch (error) {
      console.error("Failed to load or parse columns from localStorage", error);
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


  const getOrderDetails = (orderId: string) => {
    const order = purchaseOrders.find((o) => o.id === orderId);
    if (!order) return { orderNumber: 'Inconnu', supplierName: 'Inconnu' };
    const supplier = suppliers.find((s) => s.id === order.supplierId);
    return {
      orderNumber: order.orderNumber,
      supplierName: supplier?.name ?? 'Inconnu',
    };
  };
  
  const enrichedReceipts = useMemo(() => {
    return (receipts || []).map(receipt => {
      const { orderNumber, supplierName } = getOrderDetails(receipt.purchaseOrderId);
      return {
        ...receipt,
        orderNumber,
        supplierName,
        formattedDate: format(new Date(receipt.receiptDate), 'dd/MM/yyyy', { locale: fr }),
      };
    });
  }, [receipts, purchaseOrders, suppliers]);
  
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
      default:
        return <TableCell key={key}></TableCell>;
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Bons de réception récents</CardTitle>
      </CardHeader>
      <CardContent>
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
                    <TableRow key={receipt.id}>
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
      </CardContent>
    </Card>
  );
}
