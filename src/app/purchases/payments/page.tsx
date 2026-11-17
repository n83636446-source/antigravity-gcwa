'use client';

import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { supplierFromApi, purchaseInvoiceFromApi } from '@/lib/types';
import type { Reglement, PurchaseAdvance } from '@/lib/types';
import { useApiCollection } from '@/hooks/use-api';
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { useToast } from '@/hooks/use-toast';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { ActionWarning, useActionWarning } from '@/components/action-warning';
import { PageHeader } from '@/components/page-header';
import { RaDialog } from '@/components/ra-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

type EnrichedReglement = Reglement & {
  supplierName: string;
  invoicesLabel: string;
  advanceNumber?: string;
  isAdvancePayment: boolean;
  isAdvanceCancellation: boolean;
};

const MULTI_SELECTION_MESSAGE = 'Sélectionnez un seul règlement pour utiliser cette action.';
const ADVANCE_PAYMENT_MESSAGE = "Règlement d'acompte : utilisez l'annulation d'acompte.";

const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const getPaymentModeLabel = (mode?: string) => {
  switch (mode) {
    case 'cash': return 'Espèces';
    case 'check': return 'Chèque';
    case 'transfer': return 'Virement';
    default: return mode || '-';
  }
};

const columns: DataTableColumn<EnrichedReglement>[] = [
  {
    id: 'reglementNumber',
    label: 'Numéro',
    cell: (r) => <span className={cn('font-mono font-medium', r.status === 'Annulé' && 'line-through')}>{r.reglementNumber}</span>,
    sortValue: (r) => r.reglementNumber,
  },
  {
    id: 'date',
    label: 'Date',
    cell: (r) => format(new Date(r.date), 'dd/MM/yyyy', { locale: fr }),
    sortValue: (r) => r.date,
  },
  { id: 'supplierName', label: 'Fournisseur', cell: (r) => r.supplierName, sortValue: (r) => r.supplierName },
  {
    id: 'invoicesLabel',
    label: 'Factures',
    cell: (r) => <span className="font-mono text-xs">{r.invoicesLabel}</span>,
    sortValue: (r) => r.invoicesLabel || null,
  },
  {
    id: 'advanceNumber',
    label: 'Acompte',
    cell: (r) => <span className="font-mono text-xs">{r.advanceNumber ?? ''}</span>,
    sortValue: (r) => r.advanceNumber ?? null,
  },
  {
    id: 'amount',
    label: 'Montant',
    cell: (r) => <span className={cn(r.amount < 0 && 'text-red-600')}>{currencyFormatter.format(r.amount)}</span>,
    sortValue: (r) => r.amount,
    className: 'text-right font-medium',
    headClassName: 'text-right',
  },
  {
    id: 'paymentMode',
    label: 'Mode',
    cell: (r) => getPaymentModeLabel(r.paymentMode),
    sortValue: (r) => getPaymentModeLabel(r.paymentMode),
  },
  {
    id: 'status',
    label: 'Statut',
    cell: (r) => (
      <Badge
        variant={r.status === 'Actif' ? 'default' : 'secondary'}
        className={cn(r.status === 'Actif' ? (r.isAdvanceCancellation ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700') : '')}
      >
        {r.status}
      </Badge>
    ),
    sortValue: (r) => r.status,
  },
];

const columnIds = columns.map((c) => c.id);

export default function RAPage() {
  const { toast } = useToast();
  const { warning, showWarning, clearWarning } = useActionWarning();
  const cardRef = useRef<HTMLDivElement>(null);
  const tablePrefs = useTablePrefs('purchase-payments', columnIds);

  // --- STATES ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogToken, setDialogToken] = useState(0);

  useClearSelectionOnOutsideClick(cardRef, !voidDialogOpen && !deleteDialogOpen, () => setSelectedIds(new Set()));

  // --- DATA FETCHING ---
  const { data: reglements, isLoading: isLoadingReglements, refetch: refetchReglements } = useApiCollection(() => api.getReglements());
  const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useApiCollection(() => api.getPurchaseInvoices().then((r) => r.map(purchaseInvoiceFromApi)));
  const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then((r) => r.map(supplierFromApi)));
  const { data: advances, isLoading: isLoadingAdvances } = useApiCollection(() => api.getPurchaseAdvances());

  const isLoading = isLoadingReglements || isLoadingInvoices || isLoadingSuppliers || isLoadingAdvances;

  // --- DERIVED STATE ---
  const rows: EnrichedReglement[] = useMemo(() => {
    const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
    const invoiceNumberById = new Map((invoices ?? []).map((i) => [i.id, i.invoiceNumber]));
    const advanceByReglementId = new Map<string, PurchaseAdvance>();
    (advances ?? []).forEach((a) => {
      if (a.reglementId) advanceByReglementId.set(a.reglementId, a);
    });
    return (reglements ?? []).map((r) => {
      const advance = advanceByReglementId.get(r.id);
      const invoicesLabel =
        r.lines.length > 0
          ? r.lines.map((l) => invoiceNumberById.get(l.purchaseInvoiceId) || 'Inconnue').join(', ')
          : advance
            ? invoiceNumberById.get(advance.purchaseInvoiceId) || 'Inconnue'
            : '';
      return {
        ...r,
        supplierName: supplierNameById.get(r.supplierId) || 'Inconnu',
        invoicesLabel,
        advanceNumber: advance?.advanceNumber,
        isAdvancePayment: !!advance,
        isAdvanceCancellation: !!advance?.cancelsAdvanceId,
      };
    });
  }, [reglements, invoices, suppliers, advances]);

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);
  const singleSelected = selectedRows.length === 1 ? selectedRows[0] : null;
  const multiSelected = selectedRows.length > 1;
  const toolbarVisible = selectedRows.length > 0;

  const voidBlocked = multiSelected || (!!singleSelected && (singleSelected.isAdvancePayment || singleSelected.status === 'Annulé'));
  const deleteBlocked = multiSelected || (!!singleSelected && singleSelected.isAdvancePayment);

  const requireSingle = (key: string): EnrichedReglement | null => {
    if (singleSelected) return singleSelected;
    if (multiSelected) showWarning(key, MULTI_SELECTION_MESSAGE);
    return null;
  };

  // --- HANDLERS ---
  const handleCreateClick = () => {
    setShowCreateDialog(true);
    setDialogToken((prev) => prev + 1);
  };

  const handleVoidRequest = () => {
    const reglement = requireSingle('void');
    if (!reglement) return;
    if (reglement.isAdvancePayment) {
      showWarning('void', ADVANCE_PAYMENT_MESSAGE);
      return;
    }
    if (reglement.status === 'Annulé') {
      showWarning('void', 'Ce règlement est déjà annulé.');
      return;
    }
    setVoidDialogOpen(true);
  };

  const handleVoidConfirm = async () => {
    const reglement = singleSelected;
    setVoidDialogOpen(false);
    if (!reglement) return;
    try {
      await api.voidReglement(reglement.id);
      toast({ title: 'Règlement annulé', description: `Le règlement ${reglement.reglementNumber} a été annulé avec succès.` });
      refetchReglements();
      refetchInvoices();
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Annulation impossible',
        description: (error instanceof Error && error.message) || "L'annulation a échoué.",
      });
    }
  };

  const handleDeleteRequest = () => {
    const reglement = requireSingle('delete');
    if (!reglement) return;
    if (reglement.isAdvancePayment) {
      showWarning('delete', ADVANCE_PAYMENT_MESSAGE);
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const reglement = singleSelected;
    setDeleteDialogOpen(false);
    if (!reglement) return;
    try {
      await api.deleteReglement(reglement.id);
      toast({ title: 'Règlement supprimé', description: `Le règlement ${reglement.reglementNumber} a été supprimé définitivement.` });
      refetchReglements();
      refetchInvoices();
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: (error instanceof Error && error.message) || 'La suppression a échoué.',
      });
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader title="Règlements" description="Gérez vos règlements fournisseurs.">
        <Button onClick={handleCreateClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un règlement
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
              Liste des règlements
              <span
                className={cn(
                  'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                  selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 select-none'
                )}
              >
                — {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 h-10">
              <div
                className={cn(
                  'transition-all duration-300',
                  toolbarVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                )}
              >
                <ActionWarning id="void" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn('h-8 w-8', voidBlocked && 'opacity-50')}
                        onClick={handleVoidRequest}
                        aria-disabled={voidBlocked}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="sr-only">Annuler le règlement</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Annuler le règlement</TooltipContent>
                  </Tooltip>
                </ActionWarning>
              </div>

              <div
                className={cn(
                  'transition-all duration-300',
                  toolbarVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                )}
                style={{ transitionDelay: toolbarVisible ? '75ms' : '0ms' }}
              >
                <ActionWarning id="delete" warning={warning} onClose={clearWarning}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className={cn('h-8 w-8', deleteBlocked && 'opacity-50')}
                        onClick={handleDeleteRequest}
                        aria-disabled={deleteBlocked}
                      >
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
              getRowId={(r) => r.id}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => {
                clearWarning();
                setSelectedIds(ids);
              }}
              defaultSort={{ columnId: 'reglementNumber', direction: 'asc' }}
              rowClassName={(r) =>
                cn(r.status === 'Annulé' && 'opacity-60', r.isAdvanceCancellation && '[&>td]:text-red-600') || undefined
              }
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">Aucun règlement trouvé.</h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer un en sélectionnant une facture non payée.
                    </p>
                    <Button className="mt-4" onClick={handleCreateClick}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer un règlement
                    </Button>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {showCreateDialog && (
        <RaDialog
          key={`new-${dialogToken}`}
          purchaseInvoice={null}
          onSaveSuccess={() => {
            refetchReglements();
            refetchInvoices();
          }}
        />
      )}

      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce règlement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action marquera le règlement <strong>{singleSelected?.reglementNumber}</strong> comme annulé et rétablira le solde dû sur la facture correspondante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoidConfirm} className="bg-red-600 hover:bg-red-700 text-white">
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce règlement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le règlement <strong>{singleSelected?.reglementNumber}</strong>.
              {singleSelected?.status === 'Actif' && ' Le solde dû sera rétabli sur la facture correspondante.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
