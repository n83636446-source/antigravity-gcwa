'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseInvoice, Supplier, PurchaseOrder } from '@/lib/types';
import { PurchaseInvoiceDialog } from '@/components/purchase-invoice-dialog';
import { PurchaseInvoicesTable } from '@/components/purchase-invoices-table';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PurchaseInvoicesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const invoicesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseInvoices') : null),
    [firestore]
  );
  const { data: invoices, isLoading: isLoadingInvoices } = useCollection<PurchaseInvoice>(invoicesRef);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);

  const ordersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(ordersRef);
  
  const isLoading = isLoadingInvoices || isLoadingSuppliers || isLoadingOrders;

  const handleRowClick = (invoice: PurchaseInvoice) => {
    if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(null);
    } else {
        setSelectedInvoice(invoice);
    }
  };
  
  const handleRowDoubleClick = (invoice: PurchaseInvoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };
  
  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingInvoice(null);
    }
  };
  
  const handleEditClick = () => {
    if (selectedInvoice) {
      if (selectedInvoice.status !== 'Brouillon') {
        toast({
            variant: 'destructive',
            title: 'Action impossible',
            description: 'Vous ne pouvez pas modifier une facture qui n\'est pas en brouillon.',
        });
        return;
      }
      setEditingInvoice(selectedInvoice);
      setDialogOpen(true);
    }
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
  
  const handleDeleteConfirm = () => {
    if (!firestore || !invoiceToDelete) return;
    const invoiceDocRef = doc(firestore, 'purchaseInvoices', invoiceToDelete.id);
    deleteDocumentNonBlocking(invoiceDocRef);
    toast({
      title: 'Facture supprimée',
      description: `La facture "${invoiceToDelete.invoiceNumber}" a été supprimée.`,
    });
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
    setSelectedInvoice(null);
  };
  
  const handleValidateInvoice = async () => {
    if (!firestore || !selectedInvoice || selectedInvoice.status !== 'Brouillon') return;
    const invoiceRef = doc(firestore, 'purchaseInvoices', selectedInvoice.id);
    updateDocumentNonBlocking(invoiceRef, { status: 'Non payée' });
    toast({
      title: 'Facture validée',
      description: `La facture "${selectedInvoice.invoiceNumber}" est maintenant marquée comme "Non payée".`,
    });
    setSelectedInvoice(prev => prev ? { ...prev, status: 'Non payée' } : null);
  };

  const handleCancelValidation = async () => {
    if (!firestore || !selectedInvoice || selectedInvoice.status !== 'Non payée') return;
     const invoiceRef = doc(firestore, 'purchaseInvoices', selectedInvoice.id);
    updateDocumentNonBlocking(invoiceRef, { status: 'Brouillon' });
    toast({
      title: 'Validation annulée',
      description: `La facture "${selectedInvoice.invoiceNumber}" est de nouveau en brouillon.`,
    });
    setSelectedInvoice(prev => prev ? { ...prev, status: 'Brouillon' } : null);
  };


  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Factures d'achat"
        description="Gérez vos factures fournisseurs."
      >
        <PurchaseInvoiceDialog
            purchaseOrders={purchaseOrders || []}
            lastInvoiceNumber={invoices?.length || 0}
        />
      </PageHeader>
      {isLoading ? (
         <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Factures d'achat récentes</CardTitle>
            {selectedInvoice && (
              <div className="flex items-center gap-2">
                {selectedInvoice.status === 'Brouillon' && (
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
                {selectedInvoice.status === 'Non payée' && (
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleEditClick} disabled={selectedInvoice.status !== 'Brouillon'}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Modifier</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDeleteRequest} disabled={selectedInvoice.status !== 'Brouillon'}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Supprimer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer</TooltipContent>
                </Tooltip>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <PurchaseInvoicesTable 
              invoices={invoices || []}
              purchaseOrders={purchaseOrders || []}
              suppliers={suppliers || []}
              onRowClick={handleRowClick}
              onRowDoubleClick={handleRowDoubleClick}
              selectedInvoiceId={selectedInvoice?.id}
            />
          </CardContent>
        </Card>
      )}
       <PurchaseInvoiceDialog
          isOpen={dialogOpen}
          onOpenChange={handleOpenChange}
          purchaseOrders={purchaseOrders || []}
          lastInvoiceNumber={invoices?.length || 0}
          invoice={editingInvoice}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cette facture ?</AlertDialogTitle>
                <AlertDialogDescription>
                Cette action est irréversible. La facture "{invoiceToDelete?.invoiceNumber}" sera définitivement supprimée.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive hover:bg-destructive/90"
                >
                Supprimer
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
