'use client';

import { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PageHeader } from '@/components/page-header';
import type { PurchaseOrder } from '@/lib/types';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseOrderFromApi, purchaseReceiptFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, PlusCircle, ArrowRightCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BcTestDialog } from '@/components/bc-test-dialog';
import { BrTestDialog } from '@/components/br-test-dialog';
import { ActionWarning, useActionWarning } from '@/components/action-warning';

type EnrichedOrder = PurchaseOrder & {
  supplierName: string;
  receiptNumber?: string;
};

const MULTI_SELECTION_MESSAGE = 'Sélectionnez un seul bon de commande pour utiliser cette action.';

const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const columns: DataTableColumn<EnrichedOrder>[] = [
  { id: 'orderNumber', label: 'Numéro', cell: (o) => o.orderNumber, sortValue: (o) => o.orderNumber, className: 'font-medium' },
  {
    id: 'orderDate',
    label: 'Date',
    cell: (o) => format(new Date(o.orderDate), 'dd/MM/yyyy', { locale: fr }),
    sortValue: (o) => o.orderDate,
  },
  { id: 'supplierName', label: 'Fournisseur', cell: (o) => o.supplierName, sortValue: (o) => o.supplierName },
  {
    id: 'totalTTC',
    label: 'Montant TTC',
    cell: (o) => currencyFormatter.format(o.totalTTC),
    sortValue: (o) => o.totalTTC,
    className: 'text-right font-medium',
    headClassName: 'text-right',
  },
  {
    id: 'transferredTo',
    label: 'Transférée',
    cell: (o) =>
      o.receiptNumber ? (
        <span className="font-mono text-xs">{o.receiptNumber}</span>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">Non</Badge>
      ),
    sortValue: (o) => o.receiptNumber ?? null,
  },
];

const columnIds = columns.map((c) => c.id);

export default function BCTestPage() {
  const { toast } = useToast();
  const { warning, showWarning, clearWarning } = useActionWarning();
  const cardRef = useRef<HTMLDivElement>(null);
  const tablePrefs = useTablePrefs('purchase-orders', columnIds);

  // --- STATES ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderToEdit, setOrderToEdit] = useState<PurchaseOrder | null>(null);
  const [orderToTransfer, setOrderToTransfer] = useState<PurchaseOrder | null>(null);
  const [dialogToken, setDialogToken] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);

  useClearSelectionOnOutsideClick(cardRef, !deleteDialogOpen, () => setSelectedIds(new Set()));

  // --- DATA FETCHING ---
  const { data: orders, isLoading: isLoadingOrders, refetch: refetchOrders } = useApiCollection(() => api.getPurchaseOrders().then(r => r.map(purchaseOrderFromApi)));

  const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));

  const { data: receipts, refetch: refetchReceipts } = useApiCollection(() => api.getPurchaseReceipts().then(r => r.map(purchaseReceiptFromApi)));

  const isLoading = isLoadingOrders || isLoadingSuppliers;

  // --- DERIVED STATE ---
  const transferredOrderIds = useMemo(
    () => new Set((receipts || []).map(r => r.purchaseOrderId).filter(Boolean)),
    [receipts]
  );

  const rows: EnrichedOrder[] = useMemo(() => {
    const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
    const receiptNumberByOrderId = new Map<string, string>();
    (receipts ?? []).forEach((r) => {
      if (r.purchaseOrderId && !receiptNumberByOrderId.has(r.purchaseOrderId)) {
        receiptNumberByOrderId.set(r.purchaseOrderId, r.receiptNumber);
      }
    });
    return (orders ?? []).map((o) => ({
      ...o,
      supplierName: supplierNameById.get(o.supplierId) ?? 'Inconnu',
      receiptNumber: receiptNumberByOrderId.get(o.id),
    }));
  }, [orders, suppliers, receipts]);

  const selectedOrders = useMemo(() => rows.filter((o) => selectedIds.has(o.id)), [rows, selectedIds]);
  const singleSelected = selectedOrders.length === 1 ? selectedOrders[0] : null;
  const multiSelected = selectedOrders.length > 1;
  const toolbarVisible = selectedOrders.length > 0;
  const singleTransferred = !!singleSelected && transferredOrderIds.has(singleSelected.id);

  const requireSingle = (key: string): EnrichedOrder | null => {
    if (singleSelected) return singleSelected;
    if (multiSelected) showWarning(key, MULTI_SELECTION_MESSAGE);
    return null;
  };

  // --- HANDLERS ---

  const handleOpenNewOrder = () => {
    setOrderToEdit(null);
    setOrderToTransfer(null);
    sessionStorage.setItem('bcTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleRowDoubleClick = (order: PurchaseOrder) => {
    setOrderToEdit(order);
    setOrderToTransfer(null);
    sessionStorage.setItem('bcTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleEditRequest = () => {
    const order = requireSingle('edit');
    if (!order) return;
    handleRowDoubleClick(order);
  };

  const handleTransferToReceipt = () => {
    const order = requireSingle('transfer');
    if (!order) return;
    if (transferredOrderIds.has(order.id)) {
      showWarning('transfer', 'Cette commande a déjà été transférée en bon de réception.');
      return;
    }
    setOrderToTransfer(order);
    setOrderToEdit(null);
    // Use the specific transfer key to isolate from standalone BR Test
    sessionStorage.setItem('brTransferDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleDeleteRequest = () => {
    const order = requireSingle('delete');
    if (!order) return;
    if (transferredOrderIds.has(order.id)) {
      showWarning('delete', 'Cette commande a déjà été transférée en bon de réception et ne peut pas être supprimée.');
      return;
    }
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;

    if (transferredOrderIds.has(orderToDelete.id)) {
      toast({
        variant: 'destructive',
        title: 'Action impossible',
        description: 'Cette commande a déjà été transférée en bon de réception et ne peut pas être supprimée.',
      });
      setDeleteDialogOpen(false);
      return;
    }

    try {
      await api.deletePurchaseOrder(orderToDelete.id);
      refetchOrders();
      toast({
        title: 'Bon de commande supprimé',
        description: `Le bon de commande "${orderToDelete.orderNumber}" a été supprimé.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: (error instanceof Error && error.message) || 'Impossible de supprimer le bon de commande.',
      });
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
    setSelectedIds(new Set());
  };

  const editBlocked = multiSelected;
  const transferBlocked = multiSelected || singleTransferred;
  const deleteBlocked = multiSelected || singleTransferred;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de commande"
        description="Gérez vos bons de commande fournisseurs."
      >
        <Button onClick={handleOpenNewOrder}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un bon de commande
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card ref={cardRef}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Bons de commande récents
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedOrders.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedOrders.length} sélectionné{selectedOrders.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 h-10">
              {/* Modifier */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
              >
                <ActionWarning id="edit" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn("h-8 w-8", editBlocked && "opacity-50")}
                        aria-disabled={editBlocked}
                        onClick={handleEditRequest}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modifier</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              {/* Transférer en Bon de Réception */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '75ms' : '0ms' }}
              >
                <ActionWarning id="transfer" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn("h-8 w-8", transferBlocked && "opacity-50")}
                        aria-disabled={transferBlocked}
                        onClick={handleTransferToReceipt}
                      >
                        <ArrowRightCircle className="h-4 w-4" />
                        <span className="sr-only">Transférer en BR</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Transférer en Bon de Réception</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              {/* Supprimer */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '150ms' : '0ms' }}
              >
                <ActionWarning id="delete" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="destructive" size="icon" className={cn("h-8 w-8", deleteBlocked && "opacity-50")} aria-disabled={deleteBlocked} onClick={handleDeleteRequest}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              <ResetSortButton visible={tablePrefs.isCustomized} onClick={tablePrefs.resetPrefs} />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              prefs={tablePrefs}
              columns={columns}
              rows={rows}
              getRowId={(o) => o.id}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => {
                clearWarning();
                setSelectedIds(ids);
              }}
              onRowDoubleClick={handleRowDoubleClick}
              defaultSort={{ columnId: 'orderNumber', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Aucun bon de commande trouvé.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer un.
                    </p>
                    <Button className="mt-4" onClick={handleOpenNewOrder}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer un bon de commande
                    </Button>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Rendu masqué des dialogues pour permettre leur déclenchement externe */}
      <div className="hidden">
        <BcTestDialog key={`${dialogToken}-${orderToEdit?.id ?? 'new'}`} orderToEdit={orderToEdit} onSaveSuccess={() => refetchOrders()} />
        <BrTestDialog key={`transfer-${dialogToken}-${orderToTransfer?.id ?? 'none'}`} orderToTransfer={orderToTransfer} isTransferInstance={true} onSaveSuccess={() => { refetchOrders(); refetchReceipts(); }} />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon de commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le bon "{orderToDelete?.orderNumber}" sera supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
