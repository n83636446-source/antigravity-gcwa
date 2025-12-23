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
import { format, addDays } from 'date-fns';
import { Input } from './ui/input';

const purchaseInvoiceSchema = z.object({
  purchaseOrderId: z.string().nonempty('Un bon de commande doit être sélectionné.'),
  invoiceDate: z.string({ required_error: 'La date de facturation est requise.' }),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }),
});

type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

type PurchaseInvoiceDialogProps = {
  purchaseOrders: PurchaseOrder[];
  onInvoiceCreated: (invoice: PurchaseInvoice) => void;
  lastInvoiceNumber: number;
};

export function PurchaseInvoiceDialog({
  purchaseOrders,
  onInvoiceCreated,
  lastInvoiceNumber,
}: PurchaseInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [totalAmount, setTotalAmount] = useState(0);

  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      purchaseOrderId: '',
      invoiceDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    },
  });

  const purchaseOrderId = form.watch('purchaseOrderId');

  useEffect(() => {
    if (purchaseOrderId) {
      const order = purchaseOrders.find((o) => o.id === purchaseOrderId);
      if (order) {
        setTotalAmount(order.totalAmount);
      }
    } else {
      setTotalAmount(0);
    }
  }, [purchaseOrderId, purchaseOrders]);

  const onSubmit = (data: PurchaseInvoiceFormValues) => {
    const order = purchaseOrders.find((o) => o.id === data.purchaseOrderId);
    if (!order) return;
    
    const newInvoiceNumber = `FA-${(lastInvoiceNumber + 1)
      .toString()
      .padStart(4, '0')}`;
      
    const newInvoice: PurchaseInvoice = {
      id: `pi-${Date.now()}`,
      invoiceNumber: newInvoiceNumber,
      purchaseOrderId: data.purchaseOrderId,
      invoiceDate: new Date(data.invoiceDate).toISOString(),
      dueDate: new Date(data.dueDate).toISOString(),
      totalAmount: order.totalAmount,
      status: 'Non payée',
    };

    onInvoiceCreated(newInvoice);

    toast({
      title: 'Facture créée',
      description: `La facture "${newInvoice.invoiceNumber}" a été créée.`,
    });
    setOpen(false);
    form.reset({
      purchaseOrderId: '',
      invoiceDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer une facture
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Créer une facture</DialogTitle>
              <DialogDescription>
                Créez une facture à partir d'un bon de commande reçu.
              </DialogDescription>
            </DialogHeader>

            <FormField
                control={form.control}
                name="purchaseOrderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bon de commande</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Input type="date" {...field} />
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
                      <Input type="date" {...field} />
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
              <Button type="submit">Créer la facture</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
