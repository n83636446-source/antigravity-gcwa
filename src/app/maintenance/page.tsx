'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseReceipt } from '@/lib/types';
import { api } from '@/lib/api';
import { purchaseReceiptFromApi, supplierFromApi } from '@/lib/types';
import { useApiCollection } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function MaintenancePage() {
  const { toast } = useToast();

  const [forceDeleteReceipt, setForceDeleteReceipt] = useState<PurchaseReceipt | null>(null);

  const fetchReceipts = useCallback(() => api.getPurchaseReceipts().then(r => r.map(purchaseReceiptFromApi)), []);
  const { data: receipts, isLoading: isLoadingReceipts, refetch: refetchReceipts } = useApiCollection(fetchReceipts);

  const fetchSuppliers = useCallback(() => api.getSuppliers().then(r => r.map(supplierFromApi)), []);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(fetchSuppliers);

  const isLoading = isLoadingReceipts || isLoadingSuppliers;

  const requestForceDelete = (receipt: PurchaseReceipt) => {
    setForceDeleteReceipt(receipt);
  };

  const confirmForceDelete = async () => {
    if (!forceDeleteReceipt) return;
    try {
      await api.deletePurchaseReceipt(forceDeleteReceipt.id);
      refetchReceipts();
      toast({
        title: 'Suppression forcée réussie',
        description: `Le bon ${forceDeleteReceipt.receiptNumber} a été supprimé.`,
      });
      setForceDeleteReceipt(null);
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le document.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Zone de Maintenance"
        description="Forcer la suppression des bons bloqués. Cette action ne met pas à jour les stocks."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-lg">Zone de Maintenance (Urgence)</CardTitle>
            </div>
            <CardDescription className="text-red-700">
              Utilisez cette interface pour supprimer manuellement des documents corrompus ou bloqués.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-white max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left sticky top-0">
                  <tr className="border-b">
                    <th className="p-3 font-medium text-slate-600">Numéro</th>
                    <th className="p-3 font-medium text-slate-600">Date</th>
                    <th className="p-3 font-medium text-slate-600">Fournisseur</th>
                    <th className="p-3 font-medium text-slate-600">Statut</th>
                    <th className="p-3 font-medium text-slate-600 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts?.map((receipt) => (
                    <tr key={receipt.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono">{receipt.receiptNumber}</td>
                      <td className="p-3">{receipt.receiptDate ? format(new Date(receipt.receiptDate), 'dd/MM/yyyy') : '-'}</td>
                      <td className="p-3 text-muted-foreground">
                        {suppliers?.find(s => s.id === receipt.supplierId)?.name || 'Inconnu'}
                      </td>
                      <td className="p-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-semibold",
                          receipt.status === 'Validé' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        )}>
                          {receipt.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="destructive" size="sm" className="h-8" onClick={() => requestForceDelete(receipt)}>
                          <Trash2 className="mr-2 h-3 w-3" />
                          Forcer
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {receipts?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Aucun bon de réception trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!forceDeleteReceipt} onOpenChange={(open) => !open && setForceDeleteReceipt(null)}>
        <AlertDialogContent className="border-red-500 border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Suppression Forcée
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous absolument sûr de vouloir supprimer le bon <strong>{forceDeleteReceipt?.receiptNumber}</strong> ?
              <br /><br />
              <span className="text-red-700 font-semibold">ATTENTION : Cette action est irréversible et ne mettra pas à jour les niveaux de stock des articles contenus dans ce bon.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmForceDelete} className="bg-red-600 hover:bg-red-700 text-white">Confirmer la suppression</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
