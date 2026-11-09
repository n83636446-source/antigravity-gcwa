'use client';

import { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseInvoiceFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { useTablePrefs } from '@/hooks/use-table-prefs';
import { DataTable, ResetSortButton, useClearSelectionOnOutsideClick, type DataTableColumn } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import type { PurchaseAdvance } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type EnrichedAdvance = PurchaseAdvance & {
  supplierName: string;
  invoiceNumber?: string;
  reglementNumber?: string;
  typeLabel: string;
};

const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const columns: DataTableColumn<EnrichedAdvance>[] = [
  { id: 'advanceNumber', label: 'Numéro', cell: (a) => a.advanceNumber, sortValue: (a) => a.advanceNumber, className: 'font-medium' },
  {
    id: 'advanceDate',
    label: 'Date',
    cell: (a) => format(new Date(a.advanceDate), 'dd/MM/yyyy', { locale: fr }),
    sortValue: (a) => a.advanceDate,
  },
  { id: 'supplierName', label: 'Fournisseur', cell: (a) => a.supplierName, sortValue: (a) => a.supplierName },
  {
    id: 'invoiceNumber',
    label: 'Facture',
    cell: (a) => <span className="font-mono text-xs">{a.invoiceNumber ?? '—'}</span>,
    sortValue: (a) => a.invoiceNumber ?? null,
  },
  { id: 'typeLabel', label: 'Type', cell: (a) => a.typeLabel, sortValue: (a) => a.typeLabel },
  {
    id: 'totalHT',
    label: 'Total HT',
    cell: (a) => currencyFormatter.format(a.totalHT),
    sortValue: (a) => a.totalHT,
    className: 'text-right',
    headClassName: 'text-right',
  },
  {
    id: 'totalTVA',
    label: 'Total TVA',
    cell: (a) => currencyFormatter.format(a.totalTVA),
    sortValue: (a) => a.totalTVA,
    className: 'text-right',
    headClassName: 'text-right',
  },
  {
    id: 'totalTTC',
    label: 'Total TTC',
    cell: (a) => currencyFormatter.format(a.totalTTC),
    sortValue: (a) => a.totalTTC,
    className: 'text-right font-medium',
    headClassName: 'text-right',
  },
  {
    id: 'reglementNumber',
    label: 'Règlement',
    cell: (a) => <span className="font-mono text-xs">{a.reglementNumber ?? '—'}</span>,
    sortValue: (a) => a.reglementNumber ?? null,
  },
];

const columnIds = columns.map((c) => c.id);

export default function AdvancesPage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const tablePrefs = useTablePrefs('purchase-advances', columnIds);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useClearSelectionOnOutsideClick(cardRef, true, () => setSelectedIds(new Set()));

  const { data: advances, isLoading: isLoadingAdvances } = useApiCollection(() => api.getPurchaseAdvances());
  const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));
  const { data: invoices, isLoading: isLoadingInvoices } = useApiCollection(() => api.getPurchaseInvoices().then(r => r.map(purchaseInvoiceFromApi)));
  const { data: reglements, isLoading: isLoadingReglements } = useApiCollection(() => api.getReglements());

  const isLoading = isLoadingAdvances || isLoadingSuppliers || isLoadingInvoices || isLoadingReglements;

  const rows: EnrichedAdvance[] = useMemo(() => {
    const list = advances ?? [];
    const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
    const invoiceNumberById = new Map((invoices ?? []).map((i) => [i.id, i.invoiceNumber]));
    const reglementNumberById = new Map((reglements ?? []).map((r) => [r.id, r.reglementNumber]));
    const numberById = new Map(list.map((a) => [a.id, a.advanceNumber]));
    const cancelledByNumber = new Map<string, string>();
    list.forEach((a) => {
      if (a.cancelsAdvanceId) cancelledByNumber.set(a.cancelsAdvanceId, a.advanceNumber);
    });
    return list.map((a) => {
      let typeLabel = 'Acompte';
      if (a.cancelsAdvanceId) {
        typeLabel = `Annulation de ${numberById.get(a.cancelsAdvanceId) ?? '—'}`;
      } else if (cancelledByNumber.has(a.id)) {
        typeLabel = `Acompte (annulé par ${cancelledByNumber.get(a.id)})`;
      }
      return {
        ...a,
        supplierName: supplierNameById.get(a.supplierId) ?? 'Inconnu',
        invoiceNumber: invoiceNumberById.get(a.purchaseInvoiceId),
        reglementNumber: a.reglementId ? reglementNumberById.get(a.reglementId) : undefined,
        typeLabel,
      };
    });
  }, [advances, suppliers, invoices, reglements]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Factures d'acompte"
        description="Les factures d'acompte sont créées depuis une facture fournisseur."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card ref={cardRef}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Factures d'acompte
              <span className={cn(
                'ml-2 text-sm font-normal text-muted-foreground transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 select-none'
              )}>
                — {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 h-10">
              <ResetSortButton visible={tablePrefs.isCustomized} onClick={tablePrefs.resetPrefs} />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              prefs={tablePrefs}
              columns={columns}
              rows={rows}
              getRowId={(a) => a.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              defaultSort={{ columnId: 'advanceNumber', direction: 'asc' }}
              emptyMessage={
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Aucune facture d'acompte.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Elles sont créées depuis une facture fournisseur.
                    </p>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
