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
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Supplier, Product, PurchaseOrder } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from './ui/separator';

const orderItemSchema = z.object({
  productId: z.string().nonempty('Veuillez sélectionner un produit.'),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur doit être sélectionné.'),
  orderDate: z.date({ required_error: 'La date est requise.' }),
  items: z.array(orderItemSchema).min(1, 'Le bon de commande doit contenir au moins un article.'),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

type PurchaseOrderDialogProps = {
  suppliers: Supplier[];
  products: Product[];
  onOrderCreated: (order: PurchaseOrder) => void;
  lastOrderNumber: number;
};

export function PurchaseOrderDialog({ 
    suppliers, 
    products: allProducts,
    onOrderCreated,
    lastOrderNumber 
}: PurchaseOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: '',
      orderDate: new Date(),
      items: [{ productId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  const supplierId = form.watch('supplierId');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (supplierId) {
      const supplierProducts = allProducts.filter(p => p.supplierId === supplierId);
      setFilteredProducts(supplierProducts);
      form.setValue('items', [{ productId: '', quantity: 1 }]);
    } else {
      setFilteredProducts([]);
    }
  }, [supplierId, allProducts, form]);

  useEffect(() => {
    const subscription = form.watch((values) => {
        const currentItems = values.items || [];
        const newTotal = currentItems.reduce((acc, item) => {
            if(item && item.productId && item.quantity > 0) {
                const product = allProducts.find(p => p.id === item.productId);
                return acc + (product ? product.price * item.quantity : 0);
            }
            return acc;
        }, 0);
        setTotal(newTotal);
    });
    return () => subscription.unsubscribe();
  }, [form, allProducts]);


  const onSubmit = (data: PurchaseOrderFormValues) => {
    const newOrderNumber = `BC-${(lastOrderNumber + 1).toString().padStart(4, '0')}`;
    const newOrder: PurchaseOrder = {
        id: `po-${Date.now()}`,
        orderNumber: newOrderNumber,
        supplierId: data.supplierId,
        orderDate: data.orderDate.toISOString(),
        status: 'Brouillon',
        items: data.items.map(item => ({
            ...item,
            price: allProducts.find(p => p.id === item.productId)?.price || 0
        })),
        totalAmount: total,
    };

    onOrderCreated(newOrder);
    toast({
      title: 'Bon de commande créé',
      description: `Le bon de commande "${newOrder.orderNumber}" a été créé en tant que brouillon.`,
    });
    setOpen(false);
    form.reset({
        supplierId: '',
        orderDate: new Date(),
        items: [{ productId: '', quantity: 1 }],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un bon de commande
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Créer un bon de commande</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous pour créer un nouveau bon de commande.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un fournisseur" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
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
                    name="orderDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Date de commande</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP", { locale: fr })
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
                                disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                                }
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
              <FormLabel>Articles</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                   <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field: itemField }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={itemField.onChange} defaultValue={itemField.value} disabled={!supplierId}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez un produit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredProducts.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
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
                    name={`items.${index}.quantity`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" placeholder="Qté" className="w-24" {...itemField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1 })} disabled={!supplierId}>
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un article
              </Button>
            </div>
            
            <Separator />
            
            <div className="flex justify-end items-center space-x-4">
                <span className="text-lg font-semibold">Total :</span>
                <span className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                    }).format(total)}
                </span>
            </div>


            <DialogFooter>
              <Button type="submit">Créer le bon de commande</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
