'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import type { Reglement, PurchaseInvoice, Supplier, ReglementLine } from '@/lib/types';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseInvoiceFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RotateCcw, PlusCircle, Trash2 } from 'lucide-react';
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
import { cn, roundMoney } from '@/lib/utils';
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
import { ReglementTestDialog } from '@/components/reglement-test-dialog';

export default function ReglementTestPage() {
  
  const { toast } = useToast();
  
  // --- STATES ---
  const [reglementToVoid, setReglementToVoid] = useState<Reglement | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [reglementToDelete, setReglementToDelete] = useState<Reglement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogToken, setDialogToken] = useState(0);

  // --- DATA FETCHING ---
    const { data: reglements, isLoading: isLoadingReglements, refetch: refetchReglements } = useApiCollection(() => api.getReglements());
  
    const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useApiCollection(() => api.getPurchaseInvoices().then(r => r.map(purchaseInvoiceFromApi)));

    const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));
  
  const isLoading = isLoadingReglements || isLoadingInvoices || isLoadingSuppliers;

  // --- HANDLERS ---

  const handleVoidClick = (reglement: Reglement) => {
    if (reglement.status === 'Annulé') return;
    setReglementToVoid(reglement);
    setVoidDialogOpen(true);
  };

  const handleVoidConfirm = async () => {
    if (!reglementToVoid) return;
    try {
        await api.voidReglement(reglementToVoid.id);
        
        toast({ title: 'Règlement annulé', description: 'Le règlement a été annulé avec succès.' });
        refetchReglements();
    } catch (e) {
        console.error(e);
        toast({ title: 'Erreur', description: 'Une erreur est survenue.', variant: 'destructive' });
    }
    setVoidDialogOpen(false);
    setReglementToVoid(null);
};

const handleDeleteClick = (reglement: Reglement) => {
  setReglementToDelete(reglement);
  setDeleteDialogOpen(true);
};

const handleDeleteConfirm = async () => {
  if (!reglementToDelete) return;
  try {
    await api.deleteReglement(reglementToDelete.id);
    toast({ title: 'Règlement supprimé', description: 'Le règlement a été supprimé définitivement.' });
    refetchReglements();
    refetchInvoices();
  } catch (error: any) {
    toast({
      variant: 'destructive',
      title: 'Suppression impossible',
      description: error.message || 'La suppression a échoué.',
    });
  }
  setDeleteDialogOpen(false);
  setReglementToDelete(null);
};
const handleCreateClick = () => {
    setShowCreateDialog(true);
    setDialogToken(prev => prev + 1);
  };

  const getInvoiceNumbers = (lines: ReglementLine[]) =>
    lines.map(l => invoices?.find(i => i.id === l.purchaseInvoiceId)?.invoiceNumber || 'Inconnue').join(', ');

  const getSupplierName = (id: string) => {
    return suppliers?.find(s => s.id === id)?.name || 'Inconnu';
  };

  const getPaymentModeLabel = (mode?: string) => {
    switch (mode) {
      case 'cash': return 'Espèces';
      case 'check': return 'Chèque';
      case 'transfer': return 'Virement';
      default: return mode || '-';
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Règlements"
        description="Historique complet de tous les règlements fournisseurs."
      >
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
        <Card>
          <CardHeader>
              <CardTitle>Liste des règlements</CardTitle>
          </CardHeader>
          <CardContent>
              {reglements && reglements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Factures</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reglements.map((reg) => (
                      <TableRow key={reg.id} className={cn(reg.status === 'Annulé' && "opacity-60")}>
                        <TableCell className={cn("font-medium font-mono", reg.status === 'Annulé' && "line-through")}>
                          {reg.reglementNumber}
                        </TableCell>
                        <TableCell>{format(new Date(reg.date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                        <TableCell>{getSupplierName(reg.supplierId)}</TableCell>
                        <TableCell className="font-mono text-xs">{getInvoiceNumbers(reg.lines)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(reg.amount)}
                        </TableCell>
                        <TableCell>{getPaymentModeLabel(reg.paymentMode)}</TableCell>
                        <TableCell>
                          <Badge variant={reg.status === 'Actif' ? 'default' : 'secondary'} className={cn(reg.status === 'Actif' ? "bg-green-600 hover:bg-green-700" : "")}>
                            {reg.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {reg.status === 'Actif' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                    onClick={() => handleVoidClick(reg)}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Annuler ce règlement</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => handleDeleteClick(reg)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer ce règlement</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      Aucun règlement trouvé.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer un en sélectionnant une facture non payée.
                    </p>
                    <Button className="mt-4" onClick={handleCreateClick}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer un règlement
                    </Button>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {showCreateDialog && (
        <ReglementTestDialog
            key={`new-${dialogToken}`}
            purchaseInvoice={null}
            onSaveSuccess={() => { refetchReglements(); refetchInvoices(); }}
        />
      )}

      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce règlement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action marquera le règlement <strong>{reglementToVoid?.reglementNumber}</strong> comme annulé et rétablira le solde dû sur la facture correspondante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoidConfirm} className="bg-red-600 hover:bg-red-700 text-white">Confirmer l'annulation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce règlement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le règlement <strong>{reglementToDelete?.reglementNumber}</strong>.
              {reglementToDelete?.status === 'Actif' && ' Le solde dû sera rétabli sur la facture correspondante.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white">Supprimer définitivement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}











