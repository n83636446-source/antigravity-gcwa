'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseOrder, Supplier, PurchaseReceipt } from '@/lib/types';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseOrderFromApi, purchaseReceiptFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { ActionWarning, useActionWarning } from '@/components/action-warning';

export default function BCTestPage() {
  
  const { toast } = useToast();
  const { warning, showWarning, clearWarning } = useActionWarning();
  
  // --- STATES ---
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<PurchaseOrder | null>(null);
  const [orderToTransfer, setOrderToTransfer] = useState<PurchaseOrder | null>(null);
  const [dialogToken, setDialogToken] = useState(0);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);

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

  // --- HANDLERS ---

  const handleOpenNewOrder = () => {
    setOrderToEdit(null);
    setOrderToTransfer(null);
    sessionStorage.setItem('bcTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleRowClick = (order: PurchaseOrder) => {
    clearWarning();
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
    } else {
      setSelectedOrder(order);
    }
  };

  const handleRowDoubleClick = (order: PurchaseOrder) => {
    setOrderToEdit(order);
    setOrderToTransfer(null);
    sessionStorage.setItem('bcTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };
  
  const handleTransferToReceipt = () => {
    if (!selectedOrder) return;
    if (transferredOrderIds.has(selectedOrder.id)) {
      showWarning('transfer', 'Cette commande a déjà été transférée en bon de réception.');
      return;
    }
    setOrderToTransfer(selectedOrder);
    setOrderToEdit(null);
    // Use the specific transfer key to isolate from standalone BR Test
    sessionStorage.setItem('brTransferDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleDeleteRequest = () => {
    if (selectedOrder) {
      if (transferredOrderIds.has(selectedOrder.id)) {
        showWarning('delete', 'Cette commande a déjà été transférée en bon de réception et ne peut pas être supprimée.');
        return;
      }
      setOrderToDelete(selectedOrder);
      setDeleteDialogOpen(true);
    }
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
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le bon de commande.',
      });
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
    setSelectedOrder(null);
  };

  const selectedOrderTransferred = !!selectedOrder && transferredOrderIds.has(selectedOrder.id);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="BC Test"
        description="Gérez vos bons de commande dans cet environnement de test."
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bons de commande récents</CardTitle>
              <div className="flex items-center gap-2 h-10">
                  {/* Modifier */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedOrder ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedOrder ? '0ms' : '0ms' }}
                  >
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => selectedOrder && handleRowDoubleClick(selectedOrder)}
                        >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modifier</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Transférer en Bon de Réception */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedOrder ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedOrder ? '75ms' : '0ms' }}
                  >
                    <ActionWarning id="transfer" warning={warning} onClose={clearWarning}>
                      <Tooltip>
                      <TooltipTrigger asChild>
                          <Button 
                              variant="outline" 
                              size="icon" 
                              className={cn("h-8 w-8", selectedOrderTransferred && "opacity-50")}
                              aria-disabled={selectedOrderTransferred}
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
                      selectedOrder ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedOrder ? '150ms' : '0ms' }}
                  >
                    <ActionWarning id="delete" warning={warning} onClose={clearWarning}>
                      <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="destructive" size="icon" className={cn("h-8 w-8", selectedOrderTransferred && "opacity-50")} aria-disabled={selectedOrderTransferred} onClick={handleDeleteRequest}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Supprimer</span>
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
                    </ActionWarning>
                  </div>
              </div>
          </CardHeader>
          <CardContent>
              {orders && orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Montant TTC</TableHead>
                      <TableHead>Transférée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(orders || []).map((order) => (
                      <TableRow
                        key={order.id}
                        onClick={() => handleRowClick(order)}
                        onDoubleClick={() => handleRowDoubleClick(order)}
                        className={cn("cursor-pointer", selectedOrder?.id === order.id && 'bg-muted/50')}
                      >
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{format(new Date(order.orderDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                        <TableCell>{suppliers?.find(s => s.id === order.supplierId)?.name || 'Inconnu'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(order.totalTTC)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={transferredOrderIds.has(order.id) ? 'default' : 'secondary'}>
                            {transferredOrderIds.has(order.id) ? 'Oui' : 'Non'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
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
              )}
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









