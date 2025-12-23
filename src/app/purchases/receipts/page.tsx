'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import type { PurchaseReceipt, Product, Supplier, PurchaseOrder } from '@/lib/types';
import { PurchaseReceiptDialog } from '@/components/purchase-receipt-dialog';
import { PurchaseReceiptsTable } from '@/components/purchase-receipts-table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, collectionGroup, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, Pencil, Trash2 } from 'lucide-react';
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

export default function PurchaseReceiptsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PurchaseReceipt | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PurchaseReceipt | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const receiptsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseReceipts') : null),
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
  const { data: invoices } = useCollection(invoicesRef);


  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'products')) : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);


  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);
  
  const isLoading = isLoadingReceipts || isLoadingOrders || isLoadingProducts || isLoadingSuppliers;

  const handleSingleClick = (receipt: PurchaseReceipt) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    clickTimeoutRef.current = setTimeout(() => {
      if (selectedReceipt?.id === receipt.id) {
        setSelectedReceipt(null);
      } else {
        setSelectedReceipt(receipt);
      }
    }, 200);
  };

  const handleDoubleClick = (receipt: PurchaseReceipt) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setEditingReceipt(receipt);
    setDialogOpen(true);
  };
  
  const handleEditClick = () => {
    if (selectedReceipt) {
      handleDoubleClick(selectedReceipt);
    }
  };

  const handleDeleteRequest = () => {
    if (selectedReceipt) {
      setReceiptToDelete(selectedReceipt);
      setDeleteDialogOpen(true);
    }
  };
  
  const handleDeleteConfirm = () => {
    if (!firestore || !receiptToDelete) return;
    const receiptDocRef = doc(firestore, 'purchaseReceipts', receiptToDelete.id);
    // Note: Stock is not decremented on deletion. This is a business logic decision.
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
      setInvoiceDialogOpen(true);
    }
  };


  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingReceipt(null);
    }
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('tr, button')) {
      return;
    }
    setSelectedReceipt(null);
  };
  
  const selectedOrderForInvoice = useMemo(() => {
    if (!selectedReceipt || !allOrders) return undefined;
    return allOrders.find(o => o.id === selectedReceipt.purchaseOrderId);
  }, [selectedReceipt, allOrders]);


  return (
    <div className="flex flex-col gap-8 p-4 md:p-6" onClick={handleContainerClick}>
      <PageHeader
        title="Bons de réception"
        description="Gérez vos bons de réception."
      >
        <PurchaseReceiptDialog
          purchaseOrders={allOrders || []}
          products={products || []}
          lastReceiptNumber={receipts?.length || 0}
        />
      </PageHeader>
       {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <PurchaseReceiptsTable
          receipts={receipts || []}
          purchaseOrders={allOrders || []}
          suppliers={suppliers || []}
          onRowClick={handleSingleClick}
          onRowDoubleClick={handleDoubleClick}
          selectedReceiptId={selectedReceipt?.id}
          actionHeaderContent={
            selectedReceipt && (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleTransferToInvoice}>
                      <FileText className="h-4 w-4" />
                      <span className="sr-only">Transférer en Facture</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Transférer en Facture</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleEditClick}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Modifier</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDeleteRequest}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Supprimer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer</TooltipContent>
                </Tooltip>
              </div>
            )
          }
        />
      )}
      <PurchaseReceiptDialog
          isOpen={dialogOpen}
          onOpenChange={handleOpenChange}
          purchaseOrders={allOrders || []}
          products={products || []}
          lastReceiptNumber={receipts?.length || 0}
          receipt={editingReceipt}
      />
      {selectedOrderForInvoice && (
          <PurchaseInvoiceDialog
            isOpen={invoiceDialogOpen}
            onOpenChange={setInvoiceDialogOpen}
            purchaseOrders={allOrders || []}
            lastInvoiceNumber={invoices?.length || 0}
            purchaseOrder={selectedOrderForInvoice}
          />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce bon de réception ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible et ne remettra pas à jour le stock. Le bon de réception "{receiptToDelete?.receiptNumber}" sera définitivement supprimé.
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
