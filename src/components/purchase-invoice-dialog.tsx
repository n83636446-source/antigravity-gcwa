'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, PurchaseInvoice } from '@/lib/types';
import { addDays } from 'date-fns';
import { Input } from './ui/input';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const purchaseInvoiceSchema = z.object({
  purchaseOrderId: z.string().nonempty('Un bon de commande doit être sélectionné.'),
  invoiceDate: z.string({ required_error: 'La date de facturation est requise.' }),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }),
});

type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

type PurchaseInvoiceDialogProps = {
  purchaseOrders: PurchaseOrder[];
  onInvoiceCreated?: (invoice: PurchaseInvoice) => void;
  lastInvoiceNumber: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder;
  invoice?: PurchaseInvoice | null;
};

export function PurchaseInvoiceDialog({
  purchaseOrders,
  onInvoiceCreated,
  lastInvoiceNumber,
  isOpen: openProp,
  onOpenChange: onOpenChangeProp,
  purchaseOrder,
  invoice,
}: PurchaseInvoiceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const [totalAmount, setTotalAmount] = useState(0);
  const firestore = useFirestore();
  
  const isTriggeredExternally = openProp !== undefined;
  const isEditMode = !!invoice;
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;


  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      purchaseOrderId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
    },
  });

  const purchaseOrderId = form.watch('purchaseOrderId');

  useEffect(() => {
    let orderIdToUse = '';
     if (isEditMode && invoice) {
        orderIdToUse = invoice.purchaseOrderId;
        form.reset({
            purchaseOrderId: invoice.purchaseOrderId,
            invoiceDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
            dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
        });
    } else if (purchaseOrder) {
        orderIdToUse = purchaseOrder.id;
        form.setValue('purchaseOrderId', purchaseOrder.id);
    } else if (purchaseOrderId) {
        orderIdToUse = purchaseOrderId;
    }
    
    if (orderIdToUse) {
      const order = purchaseOrders.find((o) => o.id === orderIdToUse);
      if (order) {
        setTotalAmount(order.totalAmount);
      }
    } else {
      setTotalAmount(0);
    }
  }, [purchaseOrderId, purchaseOrder, invoice, isEditMode, purchaseOrders, form, isOpen]);
  
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        purchaseOrderId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
      });
      setTotalAmount(0);
    }
  }, [isOpen, form]);


  const onSubmit = (data: PurchaseInvoiceFormValues) => {
    if (!firestore) return;

    if (isEditMode && invoice) {
        const invoiceDocRef = doc(firestore, 'purchaseInvoices', invoice.id);
        updateDocumentNonBlocking(invoiceDocRef, {
            invoiceDate: new Date(data.invoiceDate).toISOString(),
            dueDate: new Date(data.dueDate).toISOString(),
        });
        toast({
            title: 'Facture modifiée',
            description: `La facture "${invoice.invoiceNumber}" a été mise à jour.`,
        });
    } else {
        const order = purchaseOrders.find((o) => o.id === data.purchaseOrderId);
        if (!order) return;
        
        const newInvoiceNumber = `FA-${(lastInvoiceNumber + 1)
        .toString()
        .padStart(4, '0')}`;
        
        const newInvoiceData: Omit<PurchaseInvoice, 'id'> = {
            invoiceNumber: newInvoiceNumber,
            purchaseOrderId: data.purchaseOrderId,
            invoiceDate: new Date(data.invoiceDate).toISOString(),
            dueDate: new Date(data.dueDate).toISOString(),
            totalAmount: order.totalAmount,
            status: 'Brouillon',
        };

        const invoicesRef = collection(firestore, 'purchaseInvoices');
        addDocumentNonBlocking(invoicesRef, newInvoiceData);

        toast({
        title: 'Facture créée',
        description: `La facture "${newInvoiceNumber}" a été créée.`,
        });
        
        onInvoiceCreated?.(newInvoiceData as PurchaseInvoice);
    }
    
    onOpenChange(false);
  };
  
  const Trigger = !isTriggeredExternally ? (
     <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer une facture
        </Button>
      </DialogTrigger>
  ) : null;
  
  const readOnly = isEditMode && invoice?.status !== 'Brouillon';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {Trigger}
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Détails de la facture' : 'Créer une facture'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? `Consultez les détails de la facture ${invoice?.invoiceNumber}.` : "Créez une facture à partir d'un bon de commande reçu."}
              </DialogDescription>
            </DialogHeader>

            <FormField
                control={form.control}
                name="purchaseOrderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bon de commande</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!purchaseOrder || isEditMode}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un bon de commande" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {purchaseOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.orderNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de facturation</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d'échéance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={readOnly}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end items-center space-x-4 pt-4">
                <span className="text-lg font-semibold">Total :</span>
                <span className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                    }).format(totalAmount)}
                </span>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {readOnly ? 'Fermer' : 'Annuler'}
              </Button>
              {!readOnly && (
                <Button type="submit">{isEditMode ? 'Enregistrer' : 'Créer la facture'}</Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
