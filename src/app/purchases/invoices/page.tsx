'use client';

import { useState, useMemo } from 'react';
import { api } from "@/lib/api";
import { supplierFromApi, purchaseInvoiceFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { PageHeader } from '@/components/page-header';
import type { PurchaseInvoice, Supplier } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle, XCircle, PlusCircle, Wallet } from 'lucide-react';
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
import { FaTestDialog } from '@/components/fa-test-dialog';
import { ReglementTestDialog } from '@/components/reglement-test-dialog';
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


export default function FATestPage() {
    const { toast } = useToast();
  
  // --- STATES ---
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<PurchaseInvoice | null>(null);
  const [dialogToken, setDialogToken] = useState(0);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);
  
  const [invoiceToReglement, setInvoiceToReglement] = useState<PurchaseInvoice | null>(null);

  // --- DATA FETCHING ---
    const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useApiCollection(() => api.getPurchaseInvoices().then(r => r.map(purchaseInvoiceFromApi)));
  
    
    const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));
  
  const isLoading = isLoadingInvoices || isLoadingSuppliers;

  // --- HANDLERS ---

  const handleOpenNewInvoice = () => {
    setInvoiceToEdit(null);
    setInvoiceToReglement(null);
    sessionStorage.setItem('faTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleRowClick = (invoice: PurchaseInvoice) => {
    if (selectedInvoice?.id === invoice.id) {
      setSelectedInvoice(null);
    } else {
      setSelectedInvoice(invoice);
    }
  };

  const handleRowDoubleClick = (invoice: PurchaseInvoice) => {
    setInvoiceToEdit(invoice);
    setInvoiceToReglement(null);
    sessionStorage.setItem('faTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };
  
  const handleDeleteRequest = () => {
    if (selectedInvoice) {
      if (selectedInvoice.status !== 'Brouillon') {
        toast({
          variant: 'destructive',
          title: 'Action impossible',
          description: 'Vous ne pouvez supprimer qu\'une facture en brouillon.',
        });
        return;
      }
      setInvoiceToDelete(selectedInvoice);
      setDeleteDialogOpen(true);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    try {
      await api.deletePurchaseInvoice(invoiceToDelete.id); 
      refetchInvoices();
      toast({
        title: 'Facture supprimée',
        description: `La facture "${invoiceToDelete.invoiceNumber}" a été supprimée.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: error.message || 'La suppression a échoué.',
      });
    }
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
    setSelectedInvoice(null);
  };

  const handleValidateInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      await api.validatePurchaseInvoice(selectedInvoice.id);
      refetchInvoices();
      toast({
        title: 'Facture validée',
        description: `La facture ${selectedInvoice.invoiceNumber} est passée en "Non payée".`
      });
      setSelectedInvoice({ ...selectedInvoice, status: 'Non payée' } as PurchaseInvoice);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: error.message || 'La validation a échoué.',
      });
    }
  };
  
  const handleCancelInvoiceValidation = async () => {
    if (!selectedInvoice) return;
    try {
      await api.cancelPurchaseInvoiceValidation(selectedInvoice.id);
      refetchInvoices();
      toast({
        title: "Validation annulée",
        description: `La facture ${selectedInvoice.invoiceNumber} est repassée en "Brouillon".`
      });
      setSelectedInvoice({ ...selectedInvoice, status: 'Brouillon' } as PurchaseInvoice);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Action impossible",
        description: error.message || "L'annulation a échoué.",
      });
    }
  };

  const handleReglerClick = () => {
    setInvoiceToReglement(selectedInvoice);
    setDialogToken(prev => prev + 1);
  };

  const getStatusBadge = (status: PurchaseInvoice['status']) => {
    switch (status) {
        case 'Brouillon':
            return <Badge variant="secondary">{status}</Badge>;
        case 'Non payée':
            return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">{status}</Badge>;
        case 'Payée':
            return <Badge variant="outline" className="border-green-600 text-green-700">{status}</Badge>;
        case 'En retard':
            return <Badge variant="destructive">{status}</Badge>;
        default:
            return <Badge>{status}</Badge>;
    }
  };
  
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="FA Test"
        description="Gérez vos factures d'achat dans cet environnement de test."
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Factures d'achat récentes</CardTitle>
              <div className="flex items-center gap-2 h-10">
                  {/* Valider / Annuler validation */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedInvoice ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                  >
                    {selectedInvoice?.status === 'Brouillon' && (
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleValidateInvoice}>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="sr-only">Valider</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Valider</TooltipContent>
                        </Tooltip>
                    )}
                    {selectedInvoice?.status === 'Non payée' && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCancelInvoiceValidation}>
                                <XCircle className="h-4 w-4 text-orange-500" />
                                <span className="sr-only">Annuler la validation</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Annuler la validation</TooltipContent>
                        </Tooltip>
                    )}
                  </div>

                  {/* Régler */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedInvoice ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedInvoice ? '75ms' : '0ms' }}
                  >
                    {selectedInvoice?.status === 'Non payée' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleReglerClick}>
                            <Wallet className="h-4 w-4 text-blue-500" />
                            <span className="sr-only">Régler</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Régler</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Modifier */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedInvoice ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedInvoice ? '150ms' : '0ms' }}
                  >
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => selectedInvoice && handleRowDoubleClick(selectedInvoice)}
                        >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modifier</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Supprimer */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedInvoice ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedInvoice ? '225ms' : '0ms' }}
                  >
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDeleteRequest} disabled={selectedInvoice?.status !== 'Brouillon'}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer</TooltipContent>
                    </Tooltip>
                  </div>
              </div>
          </CardHeader>
          <CardContent>
              {invoices && invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Montant TTC</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        onClick={() => handleRowClick(invoice)}
                        onDoubleClick={() => handleRowDoubleClick(invoice)}
                        className={cn("cursor-pointer", selectedInvoice?.id === invoice.id && 'bg-muted/50')}
                      >
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{format(new Date(invoice.invoiceDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                        <TableCell>{suppliers?.find(s => s.id === invoice.supplierId)?.name || 'Inconnu'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.totalTTC)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
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
              )}
          </CardContent>
        </Card>
      )}

      {/* Rendu masqué du dialogue pour permettre son déclenchement externe */}
      <div className="hidden">
          <FaTestDialog key={`${dialogToken}-${invoiceToEdit?.id ?? 'new'}`} invoiceToEdit={invoiceToEdit} onSaveSuccess={() => refetchInvoices()} />
          {invoiceToReglement && (
            <ReglementTestDialog key={`reglement-${dialogToken}-${invoiceToReglement.id}`} purchaseInvoice={invoiceToReglement} onSaveSuccess={() => refetchInvoices()} />
          )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La facture "{invoiceToDelete?.invoiceNumber}" sera supprimée.
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

