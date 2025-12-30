'use client';

import { PageHeader } from '@/components/page-header';
import { PurchaseCreditNoteDialog } from '@/components/purchase-credit-note-dialog';
import type {
  PurchaseCreditNote,
  Product,
  Supplier,
  PurchaseOrder,
  PurchaseInvoice,
} from '@/lib/types';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle } from 'lucide-react';

export default function CreditNotesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);

  const creditNotesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseCreditNotes') : null),
    [firestore]
  );
  const { data: creditNotes, isLoading: isLoadingCreditNotes } =
    useCollection<PurchaseCreditNote>(creditNotesRef);

  const allOrdersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseOrders') : null),
    [firestore]
  );
  const { data: allOrders, isLoading: isLoadingOrders } =
    useCollection<PurchaseOrder>(allOrdersRef);

  const productsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } =
    useCollection<Product>(productsRef);

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers } =
    useCollection<Supplier>(suppliersRef);

  const invoicesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'purchaseInvoices') : null),
    [firestore]
  );
  const { data: invoices, isLoading: isLoadingInvoices } =
    useCollection<PurchaseInvoice>(invoicesRef);

  const isLoading =
    isLoadingCreditNotes ||
    isLoadingOrders ||
    isLoadingProducts ||
    isLoadingSuppliers ||
    isLoadingInvoices;

  const lastCreditNoteNumber = useMemo(() => {
    if (!creditNotes || creditNotes.length === 0) {
      return 0;
    }
    return creditNotes.reduce((max, cn) => {
      const codeNumber = parseInt(
        (cn.creditNoteNumber || 'AV-0000').replace('AV-', ''),
        10
      );
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [creditNotes]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Avoirs Fournisseur"
        description="Gérez vos avoirs fournisseurs."
      >
        <Button onClick={() => setDialogOpen(true)}>
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
          </CardHeader>
          <CardContent>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
              <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-2xl font-bold tracking-tight">
                  Vous n'avez pas encore d'avoirs.
                </h3>
                <p className="text-sm text-muted-foreground">
                  Commencez par en créer un.
                </p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer un avoir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <PurchaseCreditNoteDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        purchaseOrders={allOrders || []}
        receipts={creditNotes || []} // Note: Passing creditNotes to a 'receipts' prop, as per cloning.
        products={products || []}
        suppliers={suppliers || []}
        lastReceiptNumber={lastCreditNoteNumber} // Note: Using creditNoteNumber for 'receipt' prop.
      />
    </div>
  );
}