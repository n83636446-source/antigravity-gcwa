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
import type {
  Product,
  PurchaseOrder,
  PurchaseReceipt,
} from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';

const receiptItemSchema = z.object({
  productId: z.string(),
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
  receiptDate: z.date({ required_error: 'La date est requise.' }),
  notes: z.string().optional(),
  items: z.array(receiptItemSchema),
});

type PurchaseReceiptFormValues = z.infer<typeof purchaseReceiptSchema>;

type PurchaseReceiptDialogProps = {
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  onReceiptCreated: (receipt: PurchaseReceipt) => void;
  lastReceiptNumber: number;
};

export function PurchaseReceiptDialog({
  purchaseOrders,
  products,
  onReceiptCreated,
  lastReceiptNumber,
}: PurchaseReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<PurchaseReceiptFormValues>({
    resolver: zodResolver(purchaseReceiptSchema),
    defaultValues: {
      purchaseOrderId: '',
      receiptDate: new Date(),
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
    return products.find((p) => p.id === productId)?.name || 'Inconnu';
  };

  const onSubmit = (data: PurchaseReceiptFormValues) => {
    const newReceiptNumber = `BR-${(lastReceiptNumber + 1)
      .toString()
      .padStart(4, '0')}`;
    const newReceipt: PurchaseReceipt = {
      id: `pr-${Date.now()}`,
      receiptNumber: newReceiptNumber,
      purchaseOrderId: data.purchaseOrderId,
      receiptDate: data.receiptDate.toISOString(),
      notes: data.notes,
      items: data.items,
    };

    onReceiptCreated(newReceipt);

    // In a real app, you would update the Purchase Order status and product stock levels.
    console.log('New Receipt:', newReceipt);

    toast({
      title: 'Bon de réception créé',
      description: `Le bon de réception "${newReceipt.receiptNumber}" a été créé.`,
    });
    setOpen(false);
    form.reset({
      purchaseOrderId: '',
      receiptDate: new Date(),
      notes: '',
      items: [],
    });
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
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de réception</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: fr })
                            ) : (
                              <span>Choisissez une date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <FormLabel>Articles Reçus</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-3 items-center gap-4">
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
                    <Textarea placeholder="Ajouter des notes sur la réception..." {...field} />
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
