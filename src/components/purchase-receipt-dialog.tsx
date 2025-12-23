'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, PurchaseOrder, PurchaseReceipt } from '@/lib/types';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch, increment } from 'firebase/firestore';

const receiptItemSchema = z.object({
  productId: z.string(),
  supplierId: z.string(),
  quantityOrdered: z.coerce.number().int(),
  quantityReceived: z.coerce
    .number()
    .int()
    .min(0, 'La quantité doit être un entier non négatif.'),
});

const purchaseReceiptSchema = z.object({
  purchaseOrderId: z
    .string()
    .nonempty('Un bon de commande doit être sélectionné.'),
  receiptDate: z.string({ required_error: 'La date est requise.' }),
  notes: z.string().optional(),
  items: z.array(receiptItemSchema),
});

type PurchaseReceiptFormValues = z.infer<typeof purchaseReceiptSchema>;

type PurchaseReceiptDialogProps = {
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  lastReceiptNumber: number;
  onReceiptCreated?: (receipt: PurchaseReceipt) => void;
};

export function PurchaseReceiptDialog({
  purchaseOrders,
  products,
  onReceiptCreated,
  lastReceiptNumber,
}: PurchaseReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<PurchaseReceiptFormValues>({
    resolver: zodResolver(purchaseReceiptSchema),
    defaultValues: {
      purchaseOrderId: '',
      receiptDate: new Date().toISOString().split('T')[0],
      notes: '',
      items: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const purchaseOrderId = form.watch('purchaseOrderId');

  useEffect(() => {
    if (purchaseOrderId) {
      const order = purchaseOrders.find((o) => o.id === purchaseOrderId);
      if (order) {
        const orderItems = order.items.map((item) => ({
          productId: item.productId,
          supplierId: order.supplierId,
          quantityOrdered: item.quantity,
          quantityReceived: item.quantity,
        }));
        replace(orderItems);
      }
    } else {
      replace([]);
    }
  }, [purchaseOrderId, purchaseOrders, replace]);

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : 'Inconnu';
  };

  const onSubmit = async (data: PurchaseReceiptFormValues) => {
    if (!firestore) return;

    const newReceiptNumber = `BR-${(lastReceiptNumber + 1)
      .toString()
      .padStart(4, '0')}`;

    const newReceiptData: Omit<PurchaseReceipt, 'id' | 'items'> & {
      items: Omit<PurchaseReceipt['items'][0], 'supplierId'>[];
    } = {
      receiptNumber: newReceiptNumber,
      purchaseOrderId: data.purchaseOrderId,
      receiptDate: new Date(data.receiptDate).toISOString(),
      notes: data.notes,
      items: data.items.map(
        ({ productId, quantityOrdered, quantityReceived }) => ({
          productId,
          quantityOrdered,
          quantityReceived,
        })
      ),
    };

    const receiptRef = collection(firestore, 'purchaseReceipts');
    const orderRef = doc(firestore, 'purchaseOrders', data.purchaseOrderId);

    const batch = writeBatch(firestore);

    const newReceiptDocRef = doc(receiptRef);
    batch.set(newReceiptDocRef, newReceiptData);

    batch.update(orderRef, { status: 'Reçu' });

    // Update stock levels
    data.items.forEach((item) => {
      if (item.quantityReceived > 0) {
        const productDocRef = doc(
          firestore,
          'suppliers',
          item.supplierId,
          'products',
          item.productId
        );
        batch.update(productDocRef, {
          stockLevel: increment(item.quantityReceived),
        });
      }
    });

    try {
      await batch.commit();
      toast({
        title: 'Bon de réception créé',
        description: `Le stock a été mis à jour.`,
      });
      // onReceiptCreated?.({ ...newReceiptData, id: newReceiptDocRef.id });

      setOpen(false);
      form.reset({
        purchaseOrderId: '',
        receiptDate: new Date().toISOString().split('T')[0],
        notes: '',
        items: [],
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le bon de réception.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un bon de réception
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Créer un bon de réception</DialogTitle>
              <DialogDescription>
                Créez un bon de réception à partir d'un bon de commande existant.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="purchaseOrderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bon de commande</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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
              <FormField
                control={form.control}
                name="receiptDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de réception</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <FormLabel className="col-span-1">Article</FormLabel>
                <FormLabel className="text-center">Qté Commandée</FormLabel>
                <FormLabel className="text-center">Qté Reçue</FormLabel>
              </div>

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-3 items-center gap-4"
                >
                  <p className="col-span-1 text-sm font-medium">
                    {getProductName(field.productId)}
                  </p>
                  <Input
                    type="number"
                    readOnly
                    disabled
                    value={field.quantityOrdered}
                    className="w-full text-center"
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantityReceived`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Qté reçue"
                            className="w-full text-center"
                            {...itemField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ajouter des notes sur la réception..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Créer le bon de réception</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
