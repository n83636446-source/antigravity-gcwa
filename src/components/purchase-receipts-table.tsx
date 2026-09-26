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
import { Button } from './ui/button';
import { PlusCircle } from 'lucide-react';

type EnrichedReceipt = PurchaseReceipt & {
  orderNumber?: string;
  supplierName: string;
  formattedDate: string;
}

type Column = {
  id: keyof EnrichedReceipt | 'orderNumber' | 'supplierName' | 'formattedDate' | 'status' | 'total_ht' | 'total_ttc';
  label: string;
};

const initialColumns: Column[] = [
  { id: 'receiptNumber', label: 'N° BR' },
  { id: 'orderNumber', label: 'N° BC' },
  { id: 'supplierName', label: 'Fournisseur' },
  { id: 'formattedDate', label: 'Date' },
  { id: 'status', label: 'Statut' },
  { id: 'total_ht', label: 'Total HT' },
  { id: 'total_ttc', label: 'Total TTC' },
];


type PurchaseReceiptsTableProps = {
  receipts: PurchaseReceipt[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  onRowClick?: (receipt: PurchaseReceipt, index?: number, e?: React.MouseEvent) => void;
  onRowDoubleClick?: (receipt: PurchaseReceipt) => void;
  selectedIds?: Set<string>;
  selectedReceiptId?: string;
  onCreateNew: () => void;
};

export function PurchaseReceiptsTable({
  receipts,
  purchaseOrders,
  suppliers,
  onRowClick,
  onRowDoubleClick,
  selectedIds,
  selectedReceiptId,
  onCreateNew,
}: PurchaseReceiptsTableProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  useEffect(() => {
    try {
      const savedColumnsJSON = localStorage.getItem('purchaseReceiptsColumns');
      if (savedColumnsJSON) {
        const savedColumns = JSON.parse(savedColumnsJSON) as Column[];
        // Basic validation: check if it's an array and has the same columns as the initial configuration.
        // This prevents errors if the column definition changes in a future update.
        const savedIds = new Set(savedColumns.map(c => c.id));
        const initialIds = new Set(initialColumns.map(c => c.id));
        if (savedColumns.length === initialColumns.length && [...savedIds].every(id => initialIds.has(id))) {
          setColumns(savedColumns);
        } else {
          // If validation fails, reset to initial columns
          setColumns(initialColumns);
        }
      }
    } catch (error) {
      console.error("Failed to load or parse columns from localStorage", error);
      setColumns(initialColumns); // Fallback to initial columns on error
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
    if (!receipts || !suppliers) return [];
    return receipts.map(receipt => {
      let orderNumber: string | undefined = 'N/A';
      const supplier = suppliers.find((s) => s.id === receipt.supplierId);
      
      if (receipt.purchaseOrderId && purchaseOrders) {
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
      case 'total_ht':
        return <TableCell key={key}>{(receipt.totalHT ?? 0).toFixed(2)} €</TableCell>;
      case 'total_ttc':
        return <TableCell key={key}>{(receipt.totalTTC ?? 0).toFixed(2)} €</TableCell>;
      default:
        return <TableCell key={key}></TableCell>;
    }
  };

  const lastReceiptNumber = useMemo(() => {
    if (!receipts || receipts.length === 0) {
      return 0;
    }
    return receipts.reduce((max, rec) => {
      const codeNumber = parseInt((rec.receiptNumber || 'BR-0000').replace('BR-', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [receipts]);


  return (
    <>
        {enrichedReceipts.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              <Table>
                <TableHeader>
                  <TableRow>
                     {columns.map(({ id, label }, index) => (
                        <DraggableHeader key={id} id={id}>
                          {label}
                        </DraggableHeader>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedReceipts.map((receipt, index) => (
                    <TableRow 
                      key={receipt.id}
                      onClick={(e) => onRowClick?.(receipt, index, e)}
                      onDoubleClick={() => onRowDoubleClick?.(receipt)}
                      className={cn("cursor-pointer", (selectedIds?.has(receipt.id) || selectedReceiptId === receipt.id) && 'bg-muted/50')}
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
               <Button className="mt-4" onClick={onCreateNew}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer un bon de réception
                </Button>
            </div>
          </div>
        )}
    </>
  );
}
