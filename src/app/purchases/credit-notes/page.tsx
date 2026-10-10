'use client';

import { useState, useMemo } from 'react';
import { api } from "@/lib/api";
import { productFromApi, supplierFromApi, purchaseCreditNoteFromApi } from "@/lib/types";
import { useApiCollection } from "@/hooks/use-api";
import { PageHeader } from '@/components/page-header';
import type { PurchaseCreditNote, Product, Supplier } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle, XCircle, PlusCircle } from 'lucide-react';
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
import { AaTestDialog } from '@/components/aa-test-dialog';
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

export default function AATestPage() {
    const { toast } = useToast();
    const { warning, showWarning, clearWarning } = useActionWarning();
  
  // --- STATES ---
  const [selectedCreditNote, setSelectedCreditNote] = useState<PurchaseCreditNote | null>(null);
  const [creditNoteToEdit, setCreditNoteToEdit] = useState<PurchaseCreditNote | null>(null);
  const [dialogToken, setDialogToken] = useState(0);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<PurchaseCreditNote | null>(null);

  // --- DATA FETCHING ---
    const { data: creditNotes, isLoading: isLoadingCreditNotes, refetch: refetchCreditNotes } = useApiCollection(() => api.getPurchaseCreditNotes().then(r => r.map(purchaseCreditNoteFromApi)));
  
    const { data: products, isLoading: isLoadingProducts, refetch: refetchProducts } = useApiCollection(() => api.getProducts().then(r => r.map(productFromApi)));

    const { data: suppliers, isLoading: isLoadingSuppliers } = useApiCollection(() => api.getSuppliers().then(r => r.map(supplierFromApi)));
  
  const isLoading = isLoadingCreditNotes || isLoadingProducts || isLoadingSuppliers;

  // --- HANDLERS ---

  const handleOpenNewCreditNote = () => {
    setCreditNoteToEdit(null);
    sessionStorage.setItem('aaTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };

  const handleRowClick = (creditNote: PurchaseCreditNote) => {
    clearWarning();
    if (selectedCreditNote?.id === creditNote.id) {
      setSelectedCreditNote(null);
    } else {
      setSelectedCreditNote(creditNote);
    }
  };

  const handleRowDoubleClick = (creditNote: PurchaseCreditNote) => {
    setCreditNoteToEdit(creditNote);
    sessionStorage.setItem('aaTestDialogState', 'true');
    setDialogToken(prev => prev + 1);
  };
  
  const handleDeleteRequest = () => {
    if (selectedCreditNote) {
      if (selectedCreditNote.status === 'Validé') {
        showWarning('delete', "Vous ne pouvez pas supprimer un avoir validé. Annulez d'abord la validation.");
        return;
      }
      setCreditNoteToDelete(selectedCreditNote);
      setDeleteDialogOpen(true);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!creditNoteToDelete) return;
    try {
      await api.deletePurchaseCreditNote(creditNoteToDelete.id);
      refetchCreditNotes();
      toast({
        title: 'Avoir supprimé',
        description: `L'avoir "${creditNoteToDelete.creditNoteNumber}" a été supprimé.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description: error.message || 'La suppression a échoué.',
      });
    }
    setDeleteDialogOpen(false);
    setCreditNoteToDelete(null);
    setSelectedCreditNote(null);
  };

  const handleValidateCreditNote = async () => {
    if (!selectedCreditNote) return;
    try {
      await api.validatePurchaseCreditNote(selectedCreditNote.id);
      refetchCreditNotes();
      refetchProducts();
      toast({ title: 'Avoir validé', description: `L'avoir ${selectedCreditNote.creditNoteNumber} a été validé.` });
      setSelectedCreditNote({ ...selectedCreditNote, status: 'Validé' } as PurchaseCreditNote);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Erreur de validation",
        description: error.message || "La validation a échoué.",
      });
    }
  };
  
  const handleCancelValidation = async () => {
    if (!selectedCreditNote) return;
    try {
      await api.cancelPurchaseCreditNoteValidation(selectedCreditNote.id);
      refetchCreditNotes();
      refetchProducts();
      toast({ title: 'Validation annulée', description: `L'avoir ${selectedCreditNote.creditNoteNumber} est de retour en brouillon.` });
      setSelectedCreditNote({ ...selectedCreditNote, status: 'Brouillon' } as PurchaseCreditNote);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Erreur d'annulation",
        description: error.message || "L'annulation a échoué.",
      });
    }
  };

  const deleteBlocked = selectedCreditNote?.status === 'Validé';

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Avoirs d'achat"
        description="Gérez vos avoirs fournisseurs dans cet environnement de test."
      >
        <Button onClick={handleOpenNewCreditNote}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un avoir
        </Button>
      </PageHeader>

       {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Avoirs récents</CardTitle>
              <div className="flex items-center gap-2 h-10">
                  {/* Valider / Annuler validation */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedCreditNote ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                  >
                    {selectedCreditNote?.status === 'Brouillon' && (
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleValidateCreditNote}>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="sr-only">Valider</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Valider</TooltipContent>
                        </Tooltip>
                    )}
                    {selectedCreditNote?.status === 'Validé' && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCancelValidation}>
                                <XCircle className="h-4 w-4 text-orange-500" />
                                <span className="sr-only">Annuler la validation</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Annuler la validation</TooltipContent>
                        </Tooltip>
                    )}
                  </div>

                  {/* Modifier */}
                  <div
                    className={cn(
                      "transition-all duration-300",
                      selectedCreditNote ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedCreditNote ? '75ms' : '0ms' }}
                  >
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => selectedCreditNote && handleRowDoubleClick(selectedCreditNote)}
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
                      selectedCreditNote ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                    )}
                    style={{ transitionDelay: selectedCreditNote ? '150ms' : '0ms' }}
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
              {creditNotes && creditNotes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditNotes.map((creditNote) => (
                      <TableRow
                        key={creditNote.id}
                        onClick={() => handleRowClick(creditNote)}
                        onDoubleClick={() => handleRowDoubleClick(creditNote)}
                        className={cn("cursor-pointer", selectedCreditNote?.id === creditNote.id && 'bg-muted/50')}
                      >
                        <TableCell className="font-medium">{creditNote.creditNoteNumber}</TableCell>
                        <TableCell>{format(new Date(creditNote.creditNoteDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                        <TableCell>{suppliers?.find(s => s.id === creditNote.supplierId)?.name || 'Inconnu'}</TableCell>
                        <TableCell>
                          <Badge variant={creditNote.status === 'Validé' ? 'default' : 'secondary'}>
                            {creditNote.status}
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
                      Aucun avoir trouvé.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Commencez par en créer un.
                    </p>
                    <Button className="mt-4" onClick={handleOpenNewCreditNote}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Créer un avoir
                    </Button>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Rendu masqué du dialogue pour permettre son déclenchement externe */}
      <div className="hidden">
          <AaTestDialog key={`${dialogToken}-${creditNoteToEdit?.id ?? 'new'}`} creditNoteToEdit={creditNoteToEdit} onSaveSuccess={() => refetchCreditNotes()} />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet avoir ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'avoir "{creditNoteToDelete?.creditNoteNumber}" sera supprimé.
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

