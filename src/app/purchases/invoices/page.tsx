'use client';

import { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseInvoiceFromApi, purchaseCreditNoteFromApi, purchaseReceiptFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { useBulkAction } from '@/hooks/use-bulk-action';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import type { PurchaseInvoice } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, CheckCircle, XCircle, PlusCircle, Wallet, ArrowRightCircle } from 'lucide-react';
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
import { cn, compareDocumentNumbers } from '@/lib/utils';
import { FaTestDialog } from '@/components/fa-test-dialog';
import { AaTestDialog } from '@/components/aa-test-dialog';
import { ReglementTestDialog } from '@/components/reglement-test-dialog';
import { ActionWarning, useActionWarning } from '@/components/action-warning';

type EnrichedInvoice = PurchaseInvoice & {
  supplierName: string;
  receiptNumber?: string;
  creditNoteNumber?: string;
};

const MULTI_SELECTION_MESSAGE = 'Sélectionnez une seule facture pour utiliser cette action.';

const sortByInvoiceNumber = <T extends { invoiceNumber: string }>(list: T[]): T[] =>
  [...list].sort((a, b) => compareDocumentNumbers(a.invoiceNumber, b.invoiceNumber));

const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const paidSortValue = (i: EnrichedInvoice): number | null => {
  if (i.status === 'Payée') return 2;
  if (i.status === 'Partiellement payée') return 1;
  if (i.status === 'Non payée' || i.status === 'En retard') return 0;
  return null;
};

const columns: DataTableColumn<EnrichedInvoice>[] = [
  { id: 'invoiceNumber', label: 'Numéro', cell: (i) => i.invoiceNumber, sortValue: (i) => i.invoiceNumber, className: 'font-medium' },
  {
    id: 'invoiceDate',
    label: 'Date',
    cell: (i) => format(new Date(i.invoiceDate), 'dd/MM/yyyy', { locale: fr }),
    sortValue: (i) => i.invoiceDate,
  },
  { id: 'supplierName', label: 'Fournisseur', cell: (i) => i.supplierName, sortValue: (i) => i.supplierName },
  {
    id: 'totalTTC',
    label: 'Montant TTC',
    cell: (i) => currencyFormatter.format(i.totalTTC),
    sortValue: (i) => i.totalTTC,
    className: 'text-right font-medium',
    headClassName: 'text-right',
  },
  {
    id: 'validated',
    label: 'Validée',
    cell: (i) =>
      i.status === 'Brouillon' ? (
        <Badge variant="outline" className="text-muted-foreground">Non</Badge>
      ) : (
        <Badge variant="outline" className="border-green-600 text-green-700">Oui</Badge>
      ),
    sortValue: (i) => (i.status === 'Brouillon' ? 0 : 1),
  },
  {
    id: 'paid',
    label: 'Réglée',
    cell: (i) =>
      i.status === 'Payée' ? (
        <Badge variant="outline" className="border-green-600 text-green-700">Oui</Badge>
      ) : i.status === 'Partiellement payée' ? (
        <Badge variant="outline" className="border-amber-500 text-amber-600">Partiellement</Badge>
      ) : i.status === 'Non payée' || i.status === 'En retard' ? (
        <Badge variant="outline" className="text-muted-foreground">Non</Badge>
      ) : (
        '—'
      ),
    sortValue: paidSortValue,
  },
  {
    id: 'origin',
    label: 'Origine',
    cell: (i) => <span className="font-mono text-xs">{i.receiptNumber ?? '—'}</span>,
    sortValue: (i) => i.receiptNumber ?? null,
  },
  {
    id: 'transferredTo',
    label: 'Transférée',
    cell: (i) =>
      i.creditNoteNumber ? (
        <span className="font-mono text-xs">{i.creditNoteNumber}</span>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">Non</Badge>
      ),
    sortValue: (i) => i.creditNoteNumber ?? null,
  },
];

const columnIds = columns.map((c) => c.id);

export default function FATestPage() {
  const { toast } = useToast();
  const { warning, showWarning, clearWarning } = useActionWarning();
  const cardRef = useRef<HTMLDivElement>(null);
  const tablePrefs = useTablePrefs('purchase-invoices', columnIds);
  const { runBulk, isRunning: isBulkRunning } = useBulkAction();

  // --- STATES ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoiceToEdit, setInvoiceToEdit] = useState<PurchaseInvoice | null>(null);
  const [dialogToken, setDialogToken] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const [invoiceToReglement, setInvoiceToReglement] = useState<PurchaseInvoice | null>(null);
  const [invoiceToTransfer, setInvoiceToTransfer] = useState<PurchaseInvoice | null>(null);
  const [validateThenTransferOpen, setValidateThenTransferOpen] = useState(false);
  const [isValidatingForTransfer, setIsValidatingForTransfer] = useState(false);
  const [validateThenPayOpen, setValidateThenPayOpen] = useState(false);
  const [isValidatingForPay, setIsValidatingForPay] = useState(false);
  const [bulkValidateOpen, setBulkValidateOpen] = useState(false);

  useClearSelectionOnOutsideClick(cardRef, !deleteDialogOpen && !validateThenTransferOpen && !validateThenPayOpen && !bulkValidateOpen, () => setSelectedIds(new Set()));

  // --- DATA FETCHING ---
  const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useApiCollection(() => api.getPurchaseInvoices().then(r => r.map(purchaseInvoiceFromApi)));

  const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));

  const { data: creditNotes, isLoading: isLoadingCreditNotes, refetch: refetchCreditNotes } = useApiCollection(() => api.getPurchaseCreditNotes().then(r => r.map(purchaseCreditNoteFromApi)));
  const { data: receipts, isLoading: isLoadingReceipts } = useApiCollection(() => api.getPurchaseReceipts().then(r => r.map(purchaseReceiptFromApi)));

  const isLoading = isLoadingInvoices || isLoadingSuppliers || isLoadingCreditNotes || isLoadingReceipts;

  // --- DERIVED STATE ---
  const rows: EnrichedInvoice[] = useMemo(() => {
    const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
    const receiptNumberById = new Map((receipts ?? []).map((r) => [r.id, r.receiptNumber]));
    const creditNoteNumberByInvoiceId = new Map<string, string>();
    (creditNotes ?? []).forEach((c) => {
      if (c.purchaseInvoiceId && !creditNoteNumberByInvoiceId.has(c.purchaseInvoiceId)) {
        creditNoteNumberByInvoiceId.set(c.purchaseInvoiceId, c.creditNoteNumber);
      }
    });
    return (invoices ?? []).map((i) => ({
      ...i,
      supplierName: supplierNameById.get(i.supplierId) ?? 'Inconnu',
      receiptNumber: i.purchaseReceiptId ? receiptNumberById.get(i.purchaseReceiptId) : undefined,
      creditNoteNumber: creditNoteNumberByInvoiceId.get(i.id),
    }));
  }, [invoices, suppliers, receipts, creditNotes]);

  const selectedInvoices = useMemo(() => rows.filter((i) => selectedIds.has(i.id)), [rows, selectedIds]);
  const singleSelected = selectedInvoices.length === 1 ? selectedInvoices[0] : null;
  const multiSelected = selectedInvoices.length > 1;
  const toolbarVisible = selectedInvoices.length > 0;
  const invoiceAlreadyCredited = !!singleSelected?.creditNoteNumber;
  const selectedDrafts = selectedInvoices.filter((i) => i.status === 'Brouillon');
  const selectedAlreadyValidatedCount = selectedInvoices.length - selectedDrafts.length;
  const draftsWithoutReceiptCount = selectedDrafts.filter((i) => !i.purchaseReceiptId).length;
  const refusedText = `${selectedAlreadyValidatedCount} facture${selectedAlreadyValidatedCount > 1 ? 's validées seront refusées' : ' validée sera refusée'}.`;
  const bulkDeleteDescription =
    selectedAlreadyValidatedCount === 0
      ? `Cette action est irréversible. Les ${selectedInvoices.length} factures sélectionnées seront supprimées.`
      : `Cette action est irréversible. ${selectedDrafts.length} des ${selectedInvoices.length} factures sélectionnées ${selectedDrafts.length > 1 ? 'seront supprimées' : 'sera supprimée'}. ${refusedText}`;

  const requireSingle = (key: string): EnrichedInvoice | null => {
    if (singleSelected) return singleSelected;
    if (multiSelected) showWarning(key, MULTI_SELECTION_MESSAGE);
    return null;
  };

  // --- HANDLERS ---

  const handleOpenNewInvoice = () => {
    setInvoiceToEdit(null);
    setInvoiceToReglement(null);
    setInvoiceToTransfer(null);
    sessionStorage.setItem('faTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleRowDoubleClick = (invoice: PurchaseInvoice) => {
    setInvoiceToEdit(invoice);
    setInvoiceToReglement(null);
    setInvoiceToTransfer(null);
    sessionStorage.setItem('faTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleEditRequest = () => {
    const invoice = requireSingle('edit');
    if (!invoice) return;
    handleRowDoubleClick(invoice);
  };

  const handleDeleteRequest = () => {
    if (isBulkRunning) return;
    if (multiSelected) {
      if (selectedDrafts.length === 0) {
        showWarning('delete', 'Les factures sélectionnées sont déjà validées.', 'Suppression impossible');
        return;
      }
      setDeleteDialogOpen(true);
      return;
    }
    const invoice = requireSingle('delete');
    if (!invoice) return;
    if (invoice.status !== 'Brouillon') {
      showWarning('delete', "Vous ne pouvez supprimer qu'une facture en brouillon.");
      return;
    }
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (multiSelected) {
      const toDelete = sortByInvoiceNumber(selectedInvoices);
      setDeleteDialogOpen(false);
      await runBulk({
        items: toDelete,
        getName: (i) => i.invoiceNumber,
        action: (i) => api.deletePurchaseInvoice(i.id),
        successLabel: (n) => `${n} facture${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}`,
        failureTitle: 'Suppression impossible',
      });
      refetchInvoices();
      setSelectedIds(new Set());
      return;
    }
    if (!invoiceToDelete) return;
    try {
      await api.deletePurchaseInvoice(invoiceToDelete.id);
      refetchInvoices();
      toast({
        title: 'Facture supprimée',
        description: `La facture "${invoiceToDelete.invoiceNumber}" a été supprimée.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: (error instanceof Error && error.message) || 'La suppression a échoué.',
      });
    }
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
    setSelectedIds(new Set());
  };

  const handleBulkValidateRequest = () => {
    if (isBulkRunning) return;
    if (selectedDrafts.length === 0) {
      showWarning('validate', 'Les factures sélectionnées sont déjà validées.');
      return;
    }
    setBulkValidateOpen(true);
  };

  const handleBulkValidateConfirm = async () => {
    const toValidate = sortByInvoiceNumber(selectedDrafts);
    setBulkValidateOpen(false);
    await runBulk({
      items: toValidate,
      getName: (i) => i.invoiceNumber,
      action: (i) => api.validatePurchaseInvoice(i.id),
      successLabel: (n) => `${n} facture${n > 1 ? 's' : ''} validée${n > 1 ? 's' : ''}`,
      failureTitle: 'Validation impossible',
    });
    refetchInvoices();
  };

  const handleValidateInvoice = async () => {
    if (multiSelected) {
      handleBulkValidateRequest();
      return;
    }
    const invoice = requireSingle('validate');
    if (!invoice) return;
    try {
      await api.validatePurchaseInvoice(invoice.id);
      refetchInvoices();
      toast({
        title: 'Facture validée',
        description: `La facture ${invoice.invoiceNumber} est passée en "Non payée".`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error && error.message) || 'La validation a échoué.',
      });
    }
  };

  const handleCancelInvoiceValidation = async () => {
    const invoice = requireSingle('cancel');
    if (!invoice) return;
    if (invoice.status === 'Partiellement payée' || invoice.status === 'Payée') {
      showWarning('cancel', "Cette facture a des règlements. Annulez-les d'abord depuis la page Règlements avant d'annuler la validation.");
      return;
    }
    if (invoiceAlreadyCredited) {
      showWarning('cancel', "Un avoir existe déjà pour cette facture. Impossible d'annuler la validation.");
      return;
    }
    try {
      await api.cancelPurchaseInvoiceValidation(invoice.id);
      refetchInvoices();
      toast({
        title: "Validation annulée",
        description: `La facture ${invoice.invoiceNumber} est repassée en "Brouillon".`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Action impossible",
        description: (error instanceof Error && error.message) || "L'annulation a échoué.",
      });
    }
  };

  const handleReglerClick = () => {
    const invoice = requireSingle('pay');
    if (!invoice) return;
    if (invoice.status === 'Payée') {
      showWarning('pay', 'Cette facture est déjà réglée en totalité.');
      return;
    }
    if (invoice.status === 'Brouillon') {
      setValidateThenPayOpen(true);
      return;
    }
    setInvoiceToTransfer(null);
    setInvoiceToReglement(invoice);
    setDialogToken(prev => prev + 1);
  };

  const handleTransferToCreditNote = () => {
    const invoice = requireSingle('transfer');
    if (!invoice) return;
    if (invoice.status === 'Brouillon') {
      setValidateThenTransferOpen(true);
      return;
    }
    if (invoiceAlreadyCredited) {
      showWarning('transfer', 'Cette facture a déjà été transférée en avoir.');
      return;
    }
    setInvoiceToEdit(null);
    setInvoiceToReglement(null);
    setInvoiceToTransfer(invoice);
    setDialogToken(prev => prev + 1);
  };

  const handleValidateAndTransfer = async () => {
    if (!singleSelected) return;
    const invoice = singleSelected;
    setIsValidatingForTransfer(true);
    try {
      await api.validatePurchaseInvoice(invoice.id);
      refetchInvoices();
      const validatedInvoice = { ...invoice, status: 'Non payée' } as PurchaseInvoice;
      toast({ title: 'Facture validée', description: `La facture ${invoice.invoiceNumber} est passée en "Non payée".` });
      setValidateThenTransferOpen(false);
      setInvoiceToEdit(null);
      setInvoiceToReglement(null);
      setInvoiceToTransfer(validatedInvoice);
      setDialogToken(prev => prev + 1);
    } catch (error) {
      setValidateThenTransferOpen(false);
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error && error.message) || 'La validation a échoué.',
      });
    } finally {
      setIsValidatingForTransfer(false);
    }
  };

  const handleValidateAndPay = async () => {
    if (!singleSelected) return;
    const invoice = singleSelected;
    setIsValidatingForPay(true);
    try {
      await api.validatePurchaseInvoice(invoice.id);
      refetchInvoices();
      const validatedInvoice = { ...invoice, status: 'Non payée' } as PurchaseInvoice;
      toast({ title: 'Facture validée', description: `La facture ${invoice.invoiceNumber} est passée en "Non payée".` });
      setValidateThenPayOpen(false);
      setInvoiceToEdit(null);
      setInvoiceToTransfer(null);
      setInvoiceToReglement(validatedInvoice);
      setDialogToken(prev => prev + 1);
    } catch (error) {
      setValidateThenPayOpen(false);
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error && error.message) || 'La validation a échoué.',
      });
    } finally {
      setIsValidatingForPay(false);
    }
  };

  const showValidateButton = singleSelected ? singleSelected.status === 'Brouillon' : multiSelected;
  const showCancelButton = !!singleSelected && singleSelected.status !== 'Brouillon';
  const validateBlocked = multiSelected && selectedDrafts.length === 0;
  const payBlocked = multiSelected || singleSelected?.status === 'Payée';
  const cancelValidationBlocked = !!singleSelected && (singleSelected.status === 'Partiellement payée' || singleSelected.status === 'Payée' || invoiceAlreadyCredited);
  const transferBlocked = multiSelected || singleSelected?.status === 'Brouillon' || invoiceAlreadyCredited;
  const editBlocked = multiSelected;
  const deleteBlocked = multiSelected ? selectedDrafts.length === 0 : !!singleSelected && singleSelected.status !== 'Brouillon';

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Factures d'achat"
        description="Gérez vos factures d'achat fournisseurs."
      >
        <Button onClick={handleOpenNewInvoice}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer une facture
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
              Factures d'achat récentes
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedInvoices.length > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedInvoices.length} sélectionnée{selectedInvoices.length > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 h-10">
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
                          onClick={handleValidateInvoice}
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
                        <Button variant="outline" size="icon" className={cn("h-8 w-8", cancelValidationBlocked && "opacity-50")} onClick={handleCancelInvoiceValidation} aria-disabled={cancelValidationBlocked}>
                          <XCircle className="h-4 w-4 text-orange-500" />
                          <span className="sr-only">Annuler la validation</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Annuler la validation</TooltipContent>
                    </Tooltip>
                  </ActionWarning>
                )}
              </div>

              {/* Régler */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '75ms' : '0ms' }}
              >
                <ActionWarning id="pay" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn("h-8 w-8", payBlocked && "opacity-50")}
                        aria-disabled={payBlocked}
                        onClick={handleReglerClick}
                      >
                        <Wallet className="h-4 w-4 text-blue-500" />
                        <span className="sr-only">Régler</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Régler</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              {/* Transférer en Avoir */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '110ms' : '0ms' }}
              >
                <ActionWarning id="transfer" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn("h-8 w-8", transferBlocked && "opacity-50")}
                        onClick={handleTransferToCreditNote}
                        aria-disabled={transferBlocked}
                      >
                        <ArrowRightCircle className="h-4 w-4" />
                        <span className="sr-only">Transférer en Avoir</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Transférer en Avoir</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              {/* Modifier */}
              <div
                className={cn(
                  "transition-all duration-300",
                  toolbarVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                )}
                style={{ transitionDelay: toolbarVisible ? '150ms' : '0ms' }}
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
                    <TooltipContent>{multiSelected ? `Supprimer (${selectedInvoices.length})` : 'Supprimer'}</TooltipContent>
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
              getRowId={(i) => i.id}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => {
                clearWarning();
                setSelectedIds(ids);
              }}
              onRowDoubleClick={handleRowDoubleClick}
              rowClassName={(i) => (i.status !== 'Brouillon' ? '[&>td]:font-semibold' : undefined)}
              defaultSort={{ columnId: 'invoiceNumber', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Aucune facture trouvée.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer une.
                    </p>
                    <Button className="mt-4" onClick={handleOpenNewInvoice}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer une facture
                    </Button>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Rendu masqué du dialogue pour permettre son déclenchement externe */}
      <div className="hidden">
        <FaTestDialog key={`${dialogToken}-${invoiceToEdit?.id ?? 'new'}`} invoiceToEdit={invoiceToEdit} onSaveSuccess={() => refetchInvoices()} />
        {invoiceToReglement && (
          <ReglementTestDialog key={`reglement-${dialogToken}-${invoiceToReglement.id}`} purchaseInvoice={invoiceToReglement} onSaveSuccess={() => refetchInvoices()} />
        )}
        <AaTestDialog key={`transfer-${dialogToken}-${invoiceToTransfer?.id ?? 'none'}`} invoiceToTransfer={invoiceToTransfer} isTransferInstance={true} onSaveSuccess={() => refetchCreditNotes()} />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!isBulkRunning) setDeleteDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {multiSelected ? `Supprimer ${selectedInvoices.length} factures ?` : 'Supprimer cette facture ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {multiSelected
                ? bulkDeleteDescription
                : `Cette action est irréversible. La facture "${invoiceToDelete?.invoiceNumber ?? ''}" sera supprimée.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkValidateOpen} onOpenChange={(open) => { if (!isBulkRunning) setBulkValidateOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {`Valider ${selectedDrafts.length} facture${selectedDrafts.length > 1 ? 's' : ''} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {draftsWithoutReceiptCount > 0
                ? `${draftsWithoutReceiptCount} facture${draftsWithoutReceiptCount > 1 ? 's' : ''} sans bon de réception ${draftsWithoutReceiptCount > 1 ? 'ajouteront' : 'ajoutera'} leurs quantités au stock.`
                : 'Les factures sélectionnées en brouillon seront validées.'}
              {selectedAlreadyValidatedCount > 0
                ? ` ${selectedAlreadyValidatedCount} facture${selectedAlreadyValidatedCount > 1 ? 's' : ''} déjà validée${selectedAlreadyValidatedCount > 1 ? 's' : ''} ${selectedAlreadyValidatedCount > 1 ? 'seront ignorées' : 'sera ignorée'}.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkValidateConfirm}>Valider</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={validateThenTransferOpen} onOpenChange={(open) => { if (!isValidatingForTransfer) setValidateThenTransferOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Facture non validée</AlertDialogTitle>
            <AlertDialogDescription>
              Cette facture n'est pas encore validée. Voulez-vous la valider puis la transférer en avoir ?
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

      <AlertDialog open={validateThenPayOpen} onOpenChange={(open) => { if (!isValidatingForPay) setValidateThenPayOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Facture non validée</AlertDialogTitle>
            <AlertDialogDescription>
              Cette facture n'est pas encore validée. Voulez-vous la valider puis la régler ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isValidatingForPay}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={isValidatingForPay} onClick={(e) => { e.preventDefault(); handleValidateAndPay(); }}>
              Valider et régler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
