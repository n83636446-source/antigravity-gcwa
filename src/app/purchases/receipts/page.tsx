'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseReceipt, Product, Supplier, PurchaseOrder, PurchaseInvoice } from '@/lib/types';
import { PurchaseReceiptDialog } from '@/components/purchase-receipt-dialog';
import { PurchaseReceiptsTable } from '@/components/purchase-receipts-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, runTransaction, getDocs, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
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
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { PurchaseInvoiceDialog } from '@/components/purchase-invoice-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PurchaseReceiptsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PurchaseReceipt | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PurchaseReceipt | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const receiptsRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'purchaseReceipts'),) : null),
    [firestore]
  );
  const { data: receipts, isLoading: isLoadingReceipts } = useCollection<PurchaseReceipt>(receiptsRef);
  
  const allOrdersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: allOrders, isLoading: isLoadingOrders } = useCollection<PurchaseOrder>(allOrdersRef);
  
  const invoicesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseInvoices') : null),
    [firestore]
  );
  const { data: invoices, isLoading: isLoadingInvoices } = useCollection<PurchaseInvoice>(invoicesRef);

  const productsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);
  
  const isLoading = isLoadingReceipts || isLoadingOrders || isLoadingProducts || isLoadingSuppliers || isLoadingInvoices;

  const lastReceiptNumber = useMemo(() => {
    if (!receipts || receipts.length === 0) {
      return 0;
    }
    return receipts.reduce((max, rec) => {
      const codeNumber = parseInt((rec.receiptNumber || 'BR-0000').replace('BR-', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [receipts]);
  
  const lastInvoiceNumber = useMemo(() => {
    if (!invoices || invoices.length === 0) {
      return 0;
    }
    return invoices.reduce((max, inv) => {
      const codeNumber = parseInt((inv.invoiceNumber || 'FA-0000').replace('FA-', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [invoices]);

  const handleRowClick = (receipt: PurchaseReceipt) => {
    if (selectedReceipt?.id === receipt.id) {
      setSelectedReceipt(null);
    } else {
      setSelectedReceipt(receipt);
    }
  };

  const handleRowDoubleClick = (receipt: PurchaseReceipt) => {
    if (receipt.status === 'Validé') {
        toast({
            variant: 'destructive',
            title: 'Action impossible',
            description: 'Vous ne pouvez pas modifier un bon de réception qui est déjà validé.',
        });
        return;
    }
    setEditingReceipt(receipt);
    setDialogOpen(true);
  };
  
  const handleEditClick = () => {
    if (selectedReceipt) {
      if (selectedReceipt.status === 'Validé') {
        toast({
            variant: 'destructive',
            title: 'Action impossible',
            description: 'Vous ne pouvez pas modifier un bon de réception qui est déjà validé.',
        });
        return;
      }
      setEditingReceipt(selectedReceipt);
      setDialogOpen(true);
    }
  };

  const handleDeleteRequest = () => {
    if (selectedReceipt) {
      if (selectedReceipt.status === 'Validé') {
        toast({
          variant: 'destructive',
          title: 'Action impossible',
          description: 'Vous ne pouvez pas supprimer un bon de réception validé. Annulez d\'abord la validation.',
        });
        return;
      }
      setReceiptToDelete(selectedReceipt);
      setDeleteDialogOpen(true);
    }
  };
  
  const handleDeleteConfirm = () => {
    if (!firestore || !receiptToDelete) return;
    const receiptDocRef = doc(firestore, 'purchaseReceipts', receiptToDelete.id);
    deleteDocumentNonBlocking(receiptDocRef);
    toast({
      title: 'Bon de réception supprimé',
      description: `Le bon de réception "${receiptToDelete.receiptNumber}" a été supprimé.`,
    });
    setDeleteDialogOpen(false);
    setReceiptToDelete(null);
    setSelectedReceipt(null);
  };
  
  const handleTransferToInvoice = () => {
    if (selectedReceipt) {
       if (selectedReceipt.status !== 'Validé') {
        toast({
          variant: 'destructive',
          title: 'Action impossible',
          description: 'Vous ne pouvez transférer qu\'un bon de réception validé.',
        });
        return;
      }
      setInvoiceDialogOpen(true);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingReceipt(null);
    }
  }
  
  const selectedOrderForInvoice = useMemo(() => {
    if (!selectedReceipt || !allOrders) return undefined;
    return allOrders.find(o => o.id === selectedReceipt.purchaseOrderId);
  }, [selectedReceipt, allOrders]);

  const handleValidateReceipt = async () => {
    if (!firestore || !selectedReceipt || selectedReceipt.status === 'Validé') return;
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const receiptRef = doc(firestore, 'purchaseReceipts', selectedReceipt.id);
        
        for (const item of selectedReceipt.items) {
          if (item.quantityReceived > 0) {
            const productRef = doc(firestore, 'products', item.productId);
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
              // We could throw an error here, but for now we'll just skip it
              // to prevent the entire transaction from failing.
              console.warn(`L'article ID "${item.productId}" est introuvable et sera ignoré.`);
              continue;
            }
            const newStock = (productDoc.data().stockLevel || 0) + item.quantityReceived;
            transaction.update(productRef, { stockLevel: newStock });
          }
        }
        
        transaction.update(receiptRef, { status: 'Validé' });
      });

      toast({
        title: 'Bon de réception validé',
        description: 'Le stock a été mis à jour avec succès.',
      });
      const updatedReceipt = { ...selectedReceipt, status: 'Validé' as const };
      setSelectedReceipt(updatedReceipt);

    } catch (error) {
      console.error("Validation transaction failed: ", error);
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: (error instanceof Error ? error.message : "La transaction a échoué. Veuillez réessayer."),
      });
    }
  };
  
  const handleCancelValidation = async () => {
    if (!firestore || !selectedReceipt || selectedReceipt.status !== 'Validé') {
      return;
    }
  
    // Check for associated invoices before starting the transaction
    if (selectedReceipt.purchaseOrderId) {
      const q = query(collection(firestore, 'purchaseInvoices'), where('purchaseOrderId', '==', selectedReceipt.purchaseOrderId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Action impossible',
          description: 'Ce bon de réception a déjà été facturé et sa validation ne peut pas être annulée.',
        });
        return;
      }
    }
  
    try {
      await runTransaction(firestore, async (transaction) => {
        const receiptRef = doc(firestore, 'purchaseReceipts', selectedReceipt.id);
  
        // Read all necessary product documents first
        const productRefs = selectedReceipt.items.map(item => doc(firestore, 'products', item.productId));
        const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
  
        // Perform checks and prepare updates
        const updates: { ref: any, data: any }[] = [];
        
        for (let i = 0; i < selectedReceipt.items.length; i++) {
          const item = selectedReceipt.items[i];
          const productDoc = productDocs[i];
  
          if (!productDoc.exists()) {
            console.warn(`L'article avec l'ID "${item.productId}" est introuvable. Il sera ignoré lors de l'annulation.`);
            continue; // Skip this item if the product doesn't exist
          }
  
          const productData = productDoc.data() as Product;
          if (productData.stockLevel < item.quantityReceived) {
            throw new Error(`Stock insuffisant pour "${productData.name}" (Actuel: ${productData.stockLevel}, Reçu: ${item.quantityReceived})`);
          }
  
          const newStock = productData.stockLevel - item.quantityReceived;
          updates.push({ ref: productDoc.ref, data: { stockLevel: newStock } });
        }
  
        // Execute all updates
        transaction.update(receiptRef, { status: 'Brouillon' });
        updates.forEach(u => transaction.update(u.ref, u.data));
      });
  
      toast({
        title: 'Validation annulée',
        description: 'Le bon de réception est de retour en brouillon et le stock a été restauré.',
      });
      // Optimistically update the UI
      setSelectedReceipt(prev => prev ? { ...prev, status: 'Brouillon' } : null);
  
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Erreur d'annulation",
        description: error.message || "L'annulation a échoué. Veuillez réessayer.",
        duration: 7000,
      });
    }
  };
  
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de réception"
        description="Gérez vos bons de réception."
      >
        <PurchaseReceiptDialog
          purchaseOrders={allOrders || []}
          receipts={receipts || []}
          products={products || []}
          suppliers={suppliers || []}
          lastReceiptNumber={lastReceiptNumber}
        />
      </PageHeader>
       {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bons de réception récents</CardTitle>
            {selectedReceipt && (
              <div className="flex items-center gap-2">
                {selectedReceipt.status === 'Brouillon' && (
                   <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleValidateReceipt} disabled={isLoading}>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="sr-only">Valider</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Valider</TooltipContent>
                    </Tooltip>
                )}
                {selectedReceipt.status === 'Validé' && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCancelValidation} disabled={isLoading}>
                            <XCircle className="h-4 w-4 text-orange-500" />
                            <span className="sr-only">Annuler la validation</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Annuler la validation</TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleTransferToInvoice} disabled={selectedReceipt.status !== 'Validé' || !selectedReceipt.purchaseOrderId || isLoading}>
                      <FileText className="h-4 w-4" />
                      <span className="sr-only">Transférer en Facture</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Transférer en Facture</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleEditClick} disabled={selectedReceipt.status === 'Validé' || isLoading}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Modifier</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDeleteRequest} disabled={selectedReceipt.status === 'Validé' || isLoading}>
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
            <PurchaseReceiptsTable
              receipts={receipts || []}
              purchaseOrders={allOrders || []}
              suppliers={suppliers || []}
              onRowClick={handleRowClick}
              onRowDoubleClick={handleRowDoubleClick}
              selectedReceiptId={selectedReceipt?.id}
            />
          </CardContent>
        </Card>
      )}
      <PurchaseReceiptDialog
          isOpen={dialogOpen}
          onOpenChange={handleOpenChange}
          purchaseOrders={allOrders || []}
          receipts={receipts || []}
          products={products || []}
          suppliers={suppliers || []}
          lastReceiptNumber={lastReceiptNumber}
          receipt={editingReceipt}
      />
      {selectedOrderForInvoice && (
          <PurchaseInvoiceDialog
            isOpen={invoiceDialogOpen}
            onOpenChange={setInvoiceDialogOpen}
            purchaseOrders={allOrders || []}
            suppliers={suppliers || []}
            products={products || []}
            lastInvoiceNumber={lastInvoiceNumber}
            purchaseOrder={selectedOrderForInvoice}
          />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce bon de réception ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le bon de réception "{receiptToDelete?.receiptNumber}" sera définitivement supprimé.
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
