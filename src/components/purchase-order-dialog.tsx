'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Separator } from './ui/separator';
import { ArticleDialog } from './article-dialog';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';


const orderItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.number(),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur doit être sélectionné.'),
  orderDate: z.string({ required_error: 'La date est requise.' }),
  items: z.array(z.object({
      productId: z.string().nonempty("Veuillez sélectionner un article."),
      quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  })).min(1, 'Le bon de commande doit contenir au moins un article.'),
});


type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

type PurchaseOrderDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  products: Product[];
  order?: PurchaseOrder;
  lastOrderNumber: number;
};

export function PurchaseOrderDialog({ 
    isOpen,
    onOpenChange,
    suppliers,
    products,
    order,
    lastOrderNumber 
}: PurchaseOrderDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!order;
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  const supplierId = form.watch('supplierId');
  const watchedItems = form.watch('items');
  const [total, setTotal] = useState(0);

  const filteredProducts = useMemo(
    () => products.filter(p => p.supplierId === supplierId),
    [products, supplierId]
  )

  useEffect(() => {
    if (isOpen) {
        if (order) {
            form.reset({
                supplierId: order.supplierId,
                orderDate: new Date(order.orderDate).toISOString().split('T')[0],
                items: order.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
            });
        } else {
            form.reset({
                supplierId: '',
                orderDate: new Date().toISOString().split('T')[0],
                items: [{ productId: '', quantity: 1 }],
            });
        }
    }
  }, [order, isOpen, form]);


  useEffect(() => {
    if (supplierId && !isEditMode) {
      replace([{ productId: '', quantity: 1 }]);
    }
  }, [supplierId, isEditMode, replace]);

  useEffect(() => {
    const newTotal = watchedItems?.reduce((acc, item) => {
        if(item && item.productId && item.quantity > 0) {
            const product = filteredProducts?.find(p => p.id === item.productId);
            return acc + (product ? product.price * item.quantity : 0);
        }
        return acc;
    }, 0) || 0;
    setTotal(newTotal);
  }, [watchedItems, filteredProducts]);


  const onSubmit = async (data: PurchaseOrderFormValues) => {
    if (!firestore) return;

    const orderData = {
        supplierId: data.supplierId,
        orderDate: new Date(data.orderDate).toISOString(),
        items: data.items.map(item => ({
            ...item,
            price: filteredProducts?.find(p => p.id === item.productId)?.price || 0
        })),
        totalAmount: total,
    };

    if (isEditMode && order) {
        const orderDocRef = doc(firestore, 'purchaseOrders', order.id);
        updateDocumentNonBlocking(orderDocRef, {
            ...orderData,
            orderNumber: order.orderNumber, // keep original order number
            status: order.status, // keep original status unless changed
        });
        toast({
            title: 'Bon de commande modifié',
            description: `Le bon de commande "${order.orderNumber}" a été mis à jour.`,
        });
    } else {
        const newOrderNumber = `BC-${(lastOrderNumber + 1).toString().padStart(4, '0')}`;
        const purchaseOrdersRef = collection(firestore, 'purchaseOrders');
        addDocumentNonBlocking(purchaseOrdersRef, {
            ...orderData,
            orderNumber: newOrderNumber,
            status: 'Brouillon' as const,
        });

        toast({
          title: 'Bon de commande créé',
          description: `Le bon de commande "${newOrderNumber}" a été créé en tant que brouillon.`,
        });
    }
    
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier le' : 'Créer un'} bon de commande</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
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
                    <FormItem>
                      <FormLabel>Date de commande</FormLabel>
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
              <FormLabel>Articles</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                   <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field: itemField }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={itemField.onChange} value={itemField.value} disabled={!supplierId}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez un article" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredProducts?.map((product) => (
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
               {supplierId && (!filteredProducts || filteredProducts.length === 0) && (
                <div className="text-sm text-muted-foreground p-2 text-center border border-dashed rounded-md">
                    Aucun article trouvé pour ce fournisseur.
                    <Button type="button" variant="link" className="p-1 h-auto" onClick={() => setArticleDialogOpen(true)}>Créer un article</Button>
                </div>
              )}
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
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
                <Button type="submit">{isEditMode ? 'Enregistrer les modifications' : 'Créer le bon de commande'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    {supplierId && (
        <ArticleDialog
            isOpen={isArticleDialogOpen}
            onOpenChange={setArticleDialogOpen}
            suppliers={suppliers.filter(s => s.id === supplierId)}
        />
    )}
    </>
  );
}
