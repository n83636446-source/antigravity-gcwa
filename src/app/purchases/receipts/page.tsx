'use client';

import { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseOrderFromApi, purchaseReceiptFromApi, purchaseInvoiceFromApi, purchaseInvoiceToApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { useBulkAction } from '@/hooks/use-bulk-action';
import { PageHeader } from '@/components/page-header';
import type { PurchaseReceipt, PurchaseInvoice } from '@/lib/types';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { cn, compareDocumentNumbers, generateId, roundMoney } from '@/lib/utils';
import { BrTestDialog } from '@/components/br-test-dialog';
import { ActionWarning, useActionWarning } from '@/components/action-warning';

type EnrichedReceipt = PurchaseReceipt & {
  orderNumber: string;
  supplierName: string;
  invoiceNumber?: string;
};

const MULTI_SELECTION_MESSAGE = 'Sélectionnez un seul bon de réception pour utiliser cette action.';

const sortByReceiptNumber = <T extends { receiptNumber: string }>(list: T[]): T[] =>
  [...list].sort((a, b) => compareDocumentNumbers(a.receiptNumber, b.receiptNumber));

const parseInvoiceNumber = (value: string): { prefix: string; digits: string } | null => {
  const match = value.trim().match(/^(.*?)(\d+)$/);
  return match ? { prefix: match[1], digits: match[2] } : null;
};

const formatInvoiceNumber = (prefix: string, digits: string, offset: number): string =>
  `${prefix}${(parseInt(digits, 10) + offset).toString().padStart(digits.length, '0')}`;

const suggestNextInvoiceNumber = (existing: { invoiceNumber: string }[]): string => {
  const maxValue = existing.reduce((max, inv) => {
    const n = parseInt(inv.invoiceNumber.replace('FA', '').trim(), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `FA${(maxValue + 1).toString().padStart(4, '0')}`;
};

const columns: DataTableColumn<EnrichedReceipt>[] = [
  {
    id: 'receiptNumber',
    label: 'N° BR',
    cell: (r) => r.receiptNumber,
    sortValue: (r) => r.receiptNumber,
    className: 'font-medium',
  },
  {
    id: 'orderNumber',
    label: 'Origine',
    cell: (r) => r.orderNumber,
    sortValue: (r) => (r.orderNumber === '—' ? null : r.orderNumber),
    className: 'font-mono text-xs',
  },
  { id: 'supplierName', label: 'Fournisseur', cell: (r) => r.supplierName, sortValue: (r) => r.supplierName },
  {
    id: 'receiptDate',
    label: 'Date',
    cell: (r) => format(new Date(r.receiptDate), 'dd/MM/yyyy', { locale: fr }),
    sortValue: (r) => r.receiptDate,
  },
  {
    id: 'status',
    label: 'Validée',
    cell: (r) =>
      r.status === 'Brouillon' ? (
        <Badge variant="outline" className="text-muted-foreground">Non</Badge>
      ) : (
        <Badge variant="outline" className="border-green-600 text-green-700">Oui</Badge>
      ),
    sortValue: (r) => (r.status === 'Validé' ? 1 : 0),
  },
  {
    id: 'transferredTo',
    label: 'Transférée',
    cell: (r) =>
      r.invoiceNumber ? (
        <span className="font-mono text-xs">{r.invoiceNumber}</span>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">Non</Badge>
      ),
    sortValue: (r) => r.invoiceNumber ?? null,
  },
  {
    id: 'totalHT',
    label: 'Total HT',
    cell: (r) => `${(r.totalHT ?? 0).toFixed(2)} €`,
    sortValue: (r) => r.totalHT ?? 0,
  },
  {
    id: 'totalTTC',
    label: 'Total TTC',
    cell: (r) => `${(r.totalTTC ?? 0).toFixed(2)} €`,
    sortValue: (r) => r.totalTTC ?? 0,
  },
];

const columnIds = columns.map((c) => c.id);

export default function BRTestPage() {
  const { toast } = useToast();
  const { warning, showWarning, clearWarning } = useActionWarning();
  const cardRef = useRef<HTMLDivElement>(null);
  const tablePrefs = useTablePrefs('purchase-receipts', columnIds);

  // --- STATES ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [receiptToEdit, setReceiptToEdit] = useState<PurchaseReceipt | null>(null);

  // Token pour forcer le re-rendu du BrTestDialog lors de l'ouverture
  const [dialogToken, setDialogToken] = useState(0);

  // Standard Delete States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PurchaseReceipt | null>(null);

  const [receiptToTransfer, setReceiptToTransfer] = useState<PurchaseReceipt | null>(null);
  const [validateThenTransferOpen, setValidateThenTransferOpen] = useState(false);
  const [isValidatingForTransfer, setIsValidatingForTransfer] = useState(false);
  const [bulkValidateOpen, setBulkValidateOpen] = useState(false);
  const { runBulk, isRunning: isBulkRunning } = useBulkAction();
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [bulkTransferFirstNumber, setBulkTransferFirstNumber] = useState('');

  useClearSelectionOnOutsideClick(
    cardRef,
    !deleteDialogOpen && !validateThenTransferOpen && !bulkValidateOpen && !bulkTransferOpen,
    () => setSelectedIds(new Set())
  );

  // --- DATA FETCHING ---
  const { data: receipts, isLoading: isLoadingReceipts, refetch: refetchReceipts } = useApiCollection(() => api.getPurchaseReceipts().then(r => r.map(purchaseReceiptFromApi)));

  const { data: allOrders, isLoading: isLoadingOrders } = useApiCollection(() => api.getPurchaseOrders().then(r => r.map(purchaseOrderFromApi)));

  const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useApiCollection(() => api.getPurchaseInvoices().then(r => r.map(purchaseInvoiceFromApi)));

  const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));

  const isLoading = isLoadingReceipts || isLoadingOrders || isLoadingSuppliers || isLoadingInvoices;

  // --- DERIVED DATA ---
  const rows: EnrichedReceipt[] = useMemo(() => {
    const orderNumberById = new Map((allOrders ?? []).map((o) => [o.id, o.orderNumber]));
    const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
    const invoiceNumberByReceiptId = new Map<string, string>();
    (invoices ?? []).forEach((inv) => {
      if (inv.purchaseReceiptId && !invoiceNumberByReceiptId.has(inv.purchaseReceiptId)) {
        invoiceNumberByReceiptId.set(inv.purchaseReceiptId, inv.invoiceNumber);
      }
    });
    return (receipts ?? []).map((r) => ({
      ...r,
      orderNumber: r.purchaseOrderId ? orderNumberById.get(r.purchaseOrderId) ?? '—' : '—',
      supplierName: supplierNameById.get(r.supplierId) ?? 'Inconnu',
      invoiceNumber: invoiceNumberByReceiptId.get(r.id),
    }));
  }, [receipts, allOrders, suppliers, invoices]);

  const selectedReceipts = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);
  const singleSelected = selectedReceipts.length === 1 ? selectedReceipts[0] : null;
  const multiSelected = selectedReceipts.length > 1;
  const toolbarVisible = selectedReceipts.length > 0;
  const selectedDrafts = selectedReceipts.filter((r) => r.status === 'Brouillon');
  const selectedAlreadyValidatedCount = selectedReceipts.length - selectedDrafts.length;
  const transferableReceipts = sortByReceiptNumber(selectedReceipts.filter((r) => !r.invoiceNumber));
  const alreadyInvoicedCount = selectedReceipts.length - transferableReceipts.length;
  const toValidateFirstCount = transferableReceipts.filter((r) => r.status === 'Brouillon').length;
  const parsedFirstNumber = parseInvoiceNumber(bulkTransferFirstNumber);
  const plannedInvoiceNumbers = parsedFirstNumber
    ? transferableReceipts.map((_, index) => formatInvoiceNumber(parsedFirstNumber.prefix, parsedFirstNumber.digits, index))
    : [];
  const existingInvoiceNumbers = new Set((invoices ?? []).map((inv) => inv.invoiceNumber));
  const conflictingInvoiceNumber = plannedInvoiceNumbers.find((n) => existingInvoiceNumbers.has(n));
  const transferNumberError = !bulkTransferFirstNumber.trim()
    ? 'Le numéro est obligatoire.'
    : !parsedFirstNumber
      ? 'Le numéro doit se terminer par des chiffres (par exemple FA0007).'
      : conflictingInvoiceNumber
        ? `Le numéro ${conflictingInvoiceNumber} est déjà utilisé.`
        : null;
  const transferPreview =
    plannedInvoiceNumbers.length > 1
      ? `${plannedInvoiceNumbers[0]} à ${plannedInvoiceNumbers[plannedInvoiceNumbers.length - 1]}`
      : plannedInvoiceNumbers[0] ?? '';

  const receiptAlreadyInvoiced = !!singleSelected && !!singleSelected.invoiceNumber;

  const requireSingle = (key: string): EnrichedReceipt | null => {
    if (singleSelected) return singleSelected;
    if (multiSelected) showWarning(key, MULTI_SELECTION_MESSAGE);
    return null;
  };

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

  const handleRowDoubleClick = (receipt: PurchaseReceipt) => {
    setReceiptToEdit(receipt);
    setReceiptToTransfer(null);
    sessionStorage.setItem('brTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleEditRequest = () => {
    const receipt = requireSingle('edit');
    if (!receipt) return;
    handleRowDoubleClick(receipt);
  };

  const handleDeleteRequest = () => {
    if (isBulkRunning) return;
    if (multiSelected) {
      if (selectedDrafts.length === 0) {
        showWarning('delete', 'Les bons de réception sélectionnés sont déjà validés.', 'Suppression impossible');
        return;
      }
      setDeleteDialogOpen(true);
      return;
    }
    const receipt = requireSingle('delete');
    if (!receipt) return;
    if (receipt.status === 'Validé') {
      showWarning('delete', 'Vous ne pouvez pas supprimer un bon de réception validé.');
      return;
    }
    setReceiptToDelete(receipt);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (multiSelected) {
      const toDelete = sortByReceiptNumber(selectedReceipts);
      setDeleteDialogOpen(false);
      await runBulk({
        items: toDelete,
        getName: (r) => r.receiptNumber,
        action: (r) => api.deletePurchaseReceipt(r.id),
        successLabel: (n) => `${n} bon${n > 1 ? 's' : ''} de réception supprimé${n > 1 ? 's' : ''}`,
        failureTitle: 'Suppression impossible',
      });
      refetchReceipts();
      setSelectedIds(new Set());
      return;
    }
    if (!receiptToDelete) return;
    try {
      await api.deletePurchaseReceipt(receiptToDelete.id);
      refetchReceipts();
      toast({
        title: 'Bon de réception supprimé',
        description: `Le bon de réception "${receiptToDelete.receiptNumber}" a été supprimé.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: (error instanceof Error && error.message) || 'La suppression a échoué.',
      });
    }
    setDeleteDialogOpen(false);
    setReceiptToDelete(null);
    setSelectedIds(new Set());
  };

  const handleBulkTransferRequest = () => {
    if (isBulkRunning) return;
    if (transferableReceipts.length === 0) {
      showWarning('transfer', 'Les bons de réception sélectionnés ont déjà été transférés en facture.', 'Transfert impossible');
      return;
    }
    setBulkTransferFirstNumber(suggestNextInvoiceNumber(invoices ?? []));
    setBulkTransferOpen(true);
  };

  const handleBulkTransferConfirm = async () => {
    if (transferNumberError || !parsedFirstNumber) return;
    const { prefix, digits } = parsedFirstNumber;
    const sources = transferableReceipts;
    let nextOffset = 0;
    setBulkTransferOpen(false);
    await runBulk({
      items: sources,
      getName: (r) => r.receiptNumber,
      action: async (receipt) => {
        if (receipt.status === 'Brouillon') {
          await api.validatePurchaseReceipt(receipt.id);
        }
        const invoiceItems = receipt.items
          .filter((item) => item.quantityReceived > 0)
          .map((item) => ({
            productId: item.productId,
            quantity: item.quantityReceived,
            price: item.price,
            tvaRate: item.tvaRate,
          }));
        if (invoiceItems.length === 0) {
          throw new Error('Aucune ligne à facturer.');
        }
        const totals = invoiceItems.reduce(
          (acc, item) => {
            const lineHT = roundMoney(item.price * item.quantity);
            const lineTVA = roundMoney(lineHT * (item.tvaRate / 100));
            return {
              totalHT: roundMoney(acc.totalHT + lineHT),
              totalTTC: roundMoney(acc.totalTTC + lineHT + lineTVA),
            };
          },
          { totalHT: 0, totalTTC: 0 }
        );
        const invoice: PurchaseInvoice = {
          id: `fa-${generateId()}`,
          invoiceNumber: formatInvoiceNumber(prefix, digits, nextOffset),
          purchaseReceiptId: receipt.id,
          supplierId: receipt.supplierId,
          items: invoiceItems,
          invoiceDate: new Date().toISOString(),
          status: 'Brouillon',
          totalHT: totals.totalHT,
          totalTTC: totals.totalTTC,
          paymentMode: receipt.paymentMode,
          dueDate: receipt.dueDate,
          representativeId: receipt.representativeId,
          reference: receipt.reference,
          remarks: receipt.remarks,
        };
        await api.createPurchaseInvoice(purchaseInvoiceToApi(invoice));
        nextOffset++;
      },
      successLabel: (n) => `${n} facture${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''}`,
      failureTitle: 'Transfert impossible',
    });
    refetchReceipts();
    refetchInvoices();
  };

  const handleTransferToInvoice = () => {
    if (multiSelected) {
      handleBulkTransferRequest();
      return;
    }
    const receipt = requireSingle('transfer');
    if (!receipt) return;
    if (receipt.status !== 'Validé') {
      setValidateThenTransferOpen(true);
      return;
    }
    if (receiptAlreadyInvoiced) {
      showWarning('transfer', 'Ce bon de réception a déjà été transféré en facture.');
      return;
    }
    setReceiptToTransfer(receipt);
    sessionStorage.setItem('faTransferDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleValidateAndTransfer = async () => {
    if (!singleSelected) return;
    const receipt = singleSelected;
    setIsValidatingForTransfer(true);
    try {
      await api.validatePurchaseReceipt(receipt.id);
      refetchReceipts();
      const validatedReceipt = { ...receipt, status: 'Validé' as const };
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

  const handleBulkValidateRequest = () => {
    if (isBulkRunning) return;
    if (selectedDrafts.length === 0) {
      showWarning('validate', 'Les bons de réception sélectionnés sont déjà validés.');
      return;
    }
    setBulkValidateOpen(true);
  };

  const handleBulkValidateConfirm = async () => {
    const toValidate = sortByReceiptNumber(selectedDrafts);
    setBulkValidateOpen(false);
    await runBulk({
      items: toValidate,
      getName: (r) => r.receiptNumber,
      action: (r) => api.validatePurchaseReceipt(r.id),
      successLabel: (n) => `${n} bon${n > 1 ? 's' : ''} de réception validé${n > 1 ? 's' : ''}`,
      failureTitle: 'Validation impossible',
    });
    refetchReceipts();
  };

  const handleValidateReceipt = async () => {
    if (multiSelected) {
      handleBulkValidateRequest();
      return;
    }
    const receipt = requireSingle('validate');
    if (!receipt || receipt.status === 'Validé') return;
    try {
      await api.validatePurchaseReceipt(receipt.id);
      refetchReceipts();
      toast({ title: 'Bon de réception validé', description: 'Le statut a été mis à jour avec succès et le stock a été modifié.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error ? error.message : "La transaction a échoué."),
      });
    }
  };

  const handleCancelValidation = async () => {
    const receipt = requireSingle('cancel');
    if (!receipt || receipt.status !== 'Validé') return;

    if (receiptAlreadyInvoiced) {
      showWarning('cancel', 'Ce bon de réception a déjà été facturé et sa validation ne peut pas être annulée.');
      return;
    }

    try {
      await api.cancelPurchaseReceiptValidation(receipt.id);
      refetchReceipts();
      toast({ title: 'Validation annulée', description: 'Le bon de réception est de retour en brouillon et le stock a été restauré.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Erreur d'annulation",
        description: error instanceof Error ? error.message : "L'annulation a échoué.",
      });
    }
  };

  const deletableCount = selectedDrafts.length;
  const refusedText = `${selectedAlreadyValidatedCount} bon${selectedAlreadyValidatedCount > 1 ? 's validés seront refusés' : ' validé sera refusé'}.`;
  const bulkDeleteDescription =
    selectedAlreadyValidatedCount === 0
      ? `Cette action est irréversible. Les ${selectedReceipts.length} bons de réception sélectionnés seront supprimés.`
      : `Cette action est irréversible. ${deletableCount} des ${selectedReceipts.length} bons de réception sélectionnés ${deletableCount > 1 ? 'seront supprimés' : 'sera supprimé'}. ${refusedText}`;

  const showValidateButton = singleSelected ? singleSelected.status === 'Brouillon' : multiSelected;
  const showCancelButton = singleSelected?.status === 'Validé';
  const validateBlocked = multiSelected && selectedDrafts.length === 0;
  const editBlocked = multiSelected;
  const transferBlocked = multiSelected
    ? transferableReceipts.length === 0
    : singleSelected?.status !== 'Validé' || receiptAlreadyInvoiced;
  const deleteBlocked = singleSelected?.status === 'Validé' || (multiSelected && selectedDrafts.length === 0);
  const cancelValidationBlocked = receiptAlreadyInvoiced;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de réception"
        description="Gérez vos bons de réception fournisseurs."
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
        <Card ref={cardRef}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Bons de réception récents
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedReceipts.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedReceipts.length} sélectionné{selectedReceipts.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Valider / Annuler validation */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
              >
                {showValidateButton && (
                  <ActionWarning id="validate" warning={warning} onClose={clearWarning}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={cn("h-8 w-8", validateBlocked && "opacity-50")}
                          aria-disabled={validateBlocked}
                          onClick={handleValidateReceipt}
                        >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="sr-only">Valider</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{multiSelected && selectedDrafts.length > 0 ? `Valider (${selectedDrafts.length})` : 'Valider'}</TooltipContent>
                    </Tooltip>
                  </ActionWarning>
                )}
                {showCancelButton && (
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
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '75ms' : '0ms' }}
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

              {/* Transférer en Facture */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '150ms' : '0ms' }}
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
                    <TooltipContent>{multiSelected && transferableReceipts.length > 0 ? `Transférer en Facture (${transferableReceipts.length})` : 'Transférer en Facture'}</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              {/* Supprimer */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '225ms' : '0ms' }}
              >
                <ActionWarning id="delete" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="destructive" size="icon" className={cn("h-8 w-8", deleteBlocked && "opacity-50")} onClick={handleDeleteRequest} aria-disabled={deleteBlocked}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{multiSelected ? `Supprimer (${selectedReceipts.length})` : 'Supprimer'}</TooltipContent>
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
              getRowId={(r) => r.id}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => {
                clearWarning();
                setSelectedIds(ids);
              }}
              onRowDoubleClick={handleRowDoubleClick}
              rowClassName={(r) => (r.status === 'Validé' ? '[&>td]:font-semibold' : undefined)}
              defaultSort={{ columnId: 'receiptNumber', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Vous n'avez pas encore de bons de réception.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer un.
                    </p>
                    <Button className="mt-4" onClick={handleOpenNewReceipt}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer un bon de réception
                    </Button>
                  </div>
                </div>
              }
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
            <AlertDialogTitle>
              {multiSelected ? `Supprimer ${selectedReceipts.length} bons de réception ?` : 'Supprimer ce bon de réception ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {multiSelected
                ? bulkDeleteDescription
                : `Cette action est irréversible. Le bon "${receiptToDelete?.receiptNumber ?? ''}" sera supprimé.`}
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

      <AlertDialog open={bulkValidateOpen} onOpenChange={(open) => { if (!isBulkRunning) setBulkValidateOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {`Valider ${selectedDrafts.length} bon${selectedDrafts.length > 1 ? 's' : ''} de réception ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              La validation ajoutera les quantités au stock.
              {selectedAlreadyValidatedCount > 0
                ? ` ${selectedAlreadyValidatedCount} bon${selectedAlreadyValidatedCount > 1 ? 's' : ''} déjà validé${selectedAlreadyValidatedCount > 1 ? 's' : ''} ${selectedAlreadyValidatedCount > 1 ? 'seront ignorés' : 'sera ignoré'}.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkValidateConfirm}>Valider</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkTransferOpen} onOpenChange={(open) => { if (!isBulkRunning) setBulkTransferOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {`Transférer ${transferableReceipts.length} bon${transferableReceipts.length > 1 ? 's' : ''} de réception en facture${transferableReceipts.length > 1 ? 's' : ''} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Une facture brouillon sera créée pour chaque bon, avec toutes ses lignes.</p>
                {toValidateFirstCount > 0 && (
                  <p>
                    {`${toValidateFirstCount} bon${toValidateFirstCount > 1 ? 's' : ''} non validé${toValidateFirstCount > 1 ? 's seront d\'abord validés' : ' sera d\'abord validé'} : la validation ajoutera les quantités au stock.`}
                  </p>
                )}
                {alreadyInvoicedCount > 0 && (
                  <p>
                    {`${alreadyInvoicedCount} bon${alreadyInvoicedCount > 1 ? 's' : ''} déjà transféré${alreadyInvoicedCount > 1 ? 's seront ignorés' : ' sera ignoré'}.`}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <label htmlFor="bulk-transfer-first-number" className="text-sm font-medium">
              Numéro de la première facture
            </label>
            <Input
              id="bulk-transfer-first-number"
              value={bulkTransferFirstNumber}
              onChange={(e) => setBulkTransferFirstNumber(e.target.value)}
              className={cn('font-mono', transferNumberError && 'border-red-500 focus-visible:ring-red-500')}
            />
            <p className={cn('min-h-5 text-sm', transferNumberError ? 'text-red-500' : 'text-muted-foreground')}>
              {transferNumberError ?? (transferPreview ? `Factures créées : ${transferPreview}` : '')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={!!transferNumberError} onClick={handleBulkTransferConfirm}>
              {toValidateFirstCount > 0 ? 'Valider et transférer' : 'Transférer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
