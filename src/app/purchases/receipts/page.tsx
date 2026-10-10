'use client';

import { useState, useEffect } from 'react';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseOrderFromApi, purchaseReceiptFromApi, purchaseInvoiceFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { PageHeader } from '@/components/page-header';
import type { PurchaseReceipt } from '@/lib/types';
import { PurchaseReceiptsTable } from '@/components/purchase-receipts-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRightCircle, Pencil, Trash2, CheckCircle, XCircle, PlusCircle } from 'lucide-react';
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
import { FaTestDialog } from '@/components/fa-test-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BrTestDialog } from '@/components/br-test-dialog';
import { ActionWarning, useActionWarning } from '@/components/action-warning';

export default function BRTestPage() {
    const { toast } = useToast();
    const { warning, showWarning, clearWarning } = useActionWarning();
  
  // --- STATES ---
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);
  const [receiptToEdit, setReceiptToEdit] = useState<PurchaseReceipt | null>(null);
  
  // Token pour forcer le re-rendu du BrTestDialog lors de l'ouverture
  const [dialogToken, setDialogToken] = useState(0);
  
  // Standard Delete States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PurchaseReceipt | null>(null);
  
  const [receiptToTransfer, setReceiptToTransfer] = useState<PurchaseReceipt | null>(null);
  const [receiptAlreadyInvoiced, setReceiptAlreadyInvoiced] = useState(false);
  const [validateThenTransferOpen, setValidateThenTransferOpen] = useState(false);
  const [isValidatingForTransfer, setIsValidatingForTransfer] = useState(false);

  // --- DATA FETCHING ---
    const { data: receipts, isLoading: isLoadingReceipts, refetch: refetchReceipts } = useApiCollection(() => api.getPurchaseReceipts().then(r => r.map(purchaseReceiptFromApi)));
  
    const { data: allOrders, isLoading: isLoadingOrders } = useApiCollection(() => api.getPurchaseOrders().then(r => r.map(purchaseOrderFromApi)));
  
    const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useApiCollection(() => api.getPurchaseInvoices().then(r => r.map(purchaseInvoiceFromApi)));

    const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));
  
  const isLoading = isLoadingReceipts || isLoadingOrders || isLoadingSuppliers || isLoadingInvoices;

  // --- GUARDS ---
  useEffect(() => {
    if (!selectedReceipt) return;
    const alreadyInvoiced = (invoices || []).some(
      inv => inv.purchaseReceiptId === selectedReceipt.id
    );
    setReceiptAlreadyInvoiced(alreadyInvoiced);
  }, [selectedReceipt, invoices]);

  // --- HANDLERS ---

  const handleOpenNewReceipt = () => {
    // Reset edit and transfer state before opening
    setReceiptToEdit(null);
    setReceiptToTransfer(null);
    // On utilise la persistence sessionStorage pour forcer l'ouverture du nouveau dialogue
    sessionStorage.setItem('brTestDialogState', 'true');
    // On incrémente le token pour forcer le composant à se remonter et lire le sessionStorage
    setDialogToken(prev => prev + 1);
  };

  const handleRowClick = (receipt: PurchaseReceipt) => {
    clearWarning();
    if (selectedReceipt?.id === receipt.id) {
      setSelectedReceipt(null);
    } else {
      setSelectedReceipt(receipt);
    }
  };

  const handleRowDoubleClick = (receipt: PurchaseReceipt) => {
    setReceiptToEdit(receipt);
    setReceiptToTransfer(null);
    sessionStorage.setItem('brTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };
  
  const handleDeleteRequest = () => {
    if (selectedReceipt) {
      if (selectedReceipt.status === 'Validé') {
        showWarning('delete', "Vous ne pouvez pas supprimer un bon de réception validé. Annulez d'abord la validation.");
        return;
      }
      setReceiptToDelete(selectedReceipt);
      setDeleteDialogOpen(true);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!receiptToDelete) return;
    try {
      await api.deletePurchaseReceipt(receiptToDelete.id); refetchReceipts();
      toast({
        title: 'Bon de réception supprimé',
        description: `Le bon de réception "${receiptToDelete.receiptNumber}" a été supprimé.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: error.message || 'La suppression a échoué.',
      });
    }
    setDeleteDialogOpen(false);
    setReceiptToDelete(null);
    setSelectedReceipt(null);
  };

const handleTransferToInvoice = () => {
    if (!selectedReceipt) return;
    if (selectedReceipt.status !== 'Validé') {
      setValidateThenTransferOpen(true);
      return;
    }
    if (receiptAlreadyInvoiced) {
      showWarning('transfer', 'Ce bon de réception a déjà été transféré en facture.');
      return;
    }
    setReceiptToTransfer(selectedReceipt);
    sessionStorage.setItem('faTransferDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleValidateAndTransfer = async () => {
    if (!selectedReceipt) return;
    setIsValidatingForTransfer(true);
    try {
      await api.validatePurchaseReceipt(selectedReceipt.id);
      refetchReceipts();
      const validatedReceipt = { ...selectedReceipt, status: 'Validé' as const };
      setSelectedReceipt(validatedReceipt);
      toast({ title: 'Bon de réception validé', description: 'Le statut a été mis à jour avec succès et le stock a été modifié.' });
      setValidateThenTransferOpen(false);
      setReceiptToTransfer(validatedReceipt);
      sessionStorage.setItem('faTransferDialogState', 'true');
      setDialogToken(prev => prev + 1);
    } catch (error) {
      setValidateThenTransferOpen(false);
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error ? error.message : 'La transaction a échoué.'),
      });
    } finally {
      setIsValidatingForTransfer(false);
    }
  };

  const handleValidateReceipt = async () => {
    if (!selectedReceipt || selectedReceipt.status === 'Validé') return;
    try {
      await api.validatePurchaseReceipt(selectedReceipt.id);
      refetchReceipts();
      toast({ title: 'Bon de réception validé', description: 'Le statut a été mis à jour avec succès et le stock a été modifié.' });
      setSelectedReceipt({ ...selectedReceipt, status: 'Validé' as const });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error ? error.message : "La transaction a échoué."),
      });
    }
  };

  const handleCancelValidation = async () => {
    if (!selectedReceipt || selectedReceipt.status !== 'Validé') return;

    const receiptAlreadyInvoiced = (invoices || []).some(
      inv => inv.purchaseReceiptId === selectedReceipt.id
    );

    if (receiptAlreadyInvoiced) {
      showWarning('cancel', 'Ce bon de réception a déjà été facturé et sa validation ne peut pas être annulée.');
      return;
    }

    try {
      await api.cancelPurchaseReceiptValidation(selectedReceipt.id);
      refetchReceipts();
      toast({ title: 'Validation annulée', description: 'Le bon de réception est de retour en brouillon et le stock a été restauré.' });
      setSelectedReceipt(prev => prev ? { ...prev, status: 'Brouillon' } : null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Erreur d'annulation", description: error.message });
    }
  };

  const transferBlocked = selectedReceipt?.status !== 'Validé' || receiptAlreadyInvoiced;
  const deleteBlocked = selectedReceipt?.status === 'Validé';
  const cancelValidationBlocked = receiptAlreadyInvoiced;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="BR Test"
        description="Clone de test pour la validation du dialogue persistant."
      >
        <Button onClick={handleOpenNewReceipt}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un bon de réception
        </Button>
      </PageHeader>

       {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bons de réception récents</CardTitle>
              <div className="flex items-center gap-2">
                  {/* Valider / Annuler validation */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedReceipt ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedReceipt ? '0ms' : '0ms' }}
                  >
                    {selectedReceipt?.status === 'Brouillon' && (
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleValidateReceipt}>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="sr-only">Valider</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Valider</TooltipContent>
                        </Tooltip>
                    )}
                    {selectedReceipt?.status === 'Validé' && (
                        <ActionWarning id="cancel" warning={warning} onClose={clearWarning}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className={cn("h-8 w-8", cancelValidationBlocked && "opacity-50")} aria-disabled={cancelValidationBlocked} onClick={handleCancelValidation}>
                                    <XCircle className="h-4 w-4 text-orange-500" />
                                    <span className="sr-only">Annuler la validation</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Annuler la validation</TooltipContent>
                            </Tooltip>
                        </ActionWarning>
                    )}
                  </div>

                  {/* Modifier */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedReceipt ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedReceipt ? '75ms' : '0ms' }}
                  >
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => selectedReceipt && handleRowDoubleClick(selectedReceipt)}
                        >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modifier</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Transférer en Facture */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedReceipt ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedReceipt ? '150ms' : '0ms' }}
                  >
                    <ActionWarning id="transfer" warning={warning} onClose={clearWarning}>
                      <Tooltip>
                      <TooltipTrigger asChild>
                          <Button 
                              variant="outline" 
                              size="icon" 
                              className={cn("h-8 w-8", transferBlocked && "opacity-50")} 
                              onClick={handleTransferToInvoice} 
                              aria-disabled={transferBlocked}
                          >
                          <ArrowRightCircle className="h-4 w-4" />
                          <span className="sr-only">Transférer en Facture</span>
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent>Transférer en Facture</TooltipContent>
                      </Tooltip>
                    </ActionWarning>
                  </div>

                  {/* Supprimer */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedReceipt ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedReceipt ? '225ms' : '0ms' }}
                  >
                    <ActionWarning id="delete" warning={warning} onClose={clearWarning}>
                      <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="destructive" size="icon" className={cn("h-8 w-8", deleteBlocked && "opacity-50")} onClick={handleDeleteRequest} aria-disabled={deleteBlocked}>
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
              <PurchaseReceiptsTable
                receipts={receipts || []}
                purchaseOrders={allOrders || []}
                suppliers={suppliers || []}
                onRowClick={handleRowClick}
                onRowDoubleClick={handleRowDoubleClick}
                selectedReceiptId={selectedReceipt?.id}
                onCreateNew={handleOpenNewReceipt}
              />
          </CardContent>
        </Card>
      )}

      {/* Rendu masqué du nouveau dialogue pour permettre son déclenchement externe */}
      <div className="hidden">
          <BrTestDialog key={`${dialogToken}-${receiptToEdit?.id ?? 'new'}`} receiptToEdit={receiptToEdit} onSaveSuccess={() => refetchReceipts()} />
          <FaTestDialog key={`transfer-${dialogToken}-${receiptToTransfer?.id ?? 'none'}`} receiptToTransfer={receiptToTransfer} isTransferInstance={true} onSaveSuccess={() => { refetchReceipts(); refetchInvoices(); }} />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon de réception ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le bon "{receiptToDelete?.receiptNumber}" sera supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={validateThenTransferOpen} onOpenChange={(open) => { if (!isValidatingForTransfer) setValidateThenTransferOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bon de réception non validé</AlertDialogTitle>
            <AlertDialogDescription>
              Ce bon de réception n'est pas encore validé. Voulez-vous le valider puis le transférer en facture ? La validation ajoutera les quantités au stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isValidatingForTransfer}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={isValidatingForTransfer} onClick={(e) => { e.preventDefault(); handleValidateAndTransfer(); }}>
              Valider et transférer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
