'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Supplier, Product, PurchaseOrder } from '@/lib/types';
import { Separator } from './ui/separator';
import { ArticleDialog } from './article-dialog';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { PlusCircle } from 'lucide-react';


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
  order?: PurchaseOrder;
  lastOrderNumber: number;
  onTransfer?: (order: PurchaseOrder) => void;
};

const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';

export function PurchaseOrderDialog({ 
    isOpen,
    onOpenChange,
    suppliers,
    order,
    lastOrderNumber,
    onTransfer
}: PurchaseOrderDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!order;
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: products } = useCollection<Product>(productsRef);

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
  });

  const { fields, append, remove, replace, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  const watchedItems = form.watch('items');
  const [total, setTotal] = useState(0);

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
    const newTotal = watchedItems?.reduce((acc, item) => {
        if(item && item.productId && item.quantity > 0) {
            const product = products?.find(p => p.id === item.productId);
            return acc + (product ? product.price * item.quantity : 0);
        }
        return acc;
    }, 0) || 0;
    setTotal(newTotal);
  }, [watchedItems, products]);


  const onSubmit = async (data: PurchaseOrderFormValues) => {
    if (!firestore) return;
    
    const orderData = {
        supplierId: data.supplierId,
        orderDate: new Date(data.orderDate).toISOString(),
        items: data.items.map(item => ({
            ...item,
            price: products?.find(p => p.id === item.productId)?.price || 0
        })),
        totalAmount: total,
    };

    if (isEditMode && order) {
        const orderDocRef = doc(firestore, 'purchaseOrders', order.id);
        updateDocumentNonBlocking(orderDocRef, {
            ...orderData,
            orderNumber: order.orderNumber, // keep original order number
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
        });

        toast({
          title: 'Bon de commande créé',
          description: `Le bon de commande "${newOrderNumber}" a été créé.`,
        });
    }
    
    onOpenChange(false);
  };

  const handleProductChange = (value: string, index: number) => {
    if (value === CREATE_NEW_ARTICLE_VALUE) {
      articleCreationIndex.current = index;
      setArticleDialogOpen(true);
    } else {
      update(index, { ...fields[index], productId: value });
    }
  };

  const handleArticleCreated = (newArticle: Product) => {
    if (newArticle && newArticle.id && articleCreationIndex.current !== null) {
      update(articleCreationIndex.current, { ...fields[articleCreationIndex.current], productId: newArticle.id });
    }
    articleCreationIndex.current = null;
    setArticleDialogOpen(false);
  };

  const handleTransferClick = () => {
    if (order && onTransfer) {
        onTransfer(order);
    }
  }


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
                        <Select onValueChange={(value) => handleProductChange(value, index)} value={itemField.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez un article" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={CREATE_NEW_ARTICLE_VALUE}>
                                <div className="flex items-center gap-2">
                                    <PlusCircle className="h-4 w-4" />
                                    <span>Créer un nouvel article</span>
                                </div>
                            </SelectItem>
                            <Separator />
                            {products?.map((product) => (
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
               {(!products || products.length === 0) && (
                <div className="text-sm text-muted-foreground p-2 text-center border border-dashed rounded-md">
                    Aucun article trouvé.
                    <Button type="button" variant="link" className="p-1 h-auto" onClick={() => setArticleDialogOpen(true)}>Créer un article</Button>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1 })}>
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

            <DialogFooter className="sm:justify-between">
              <div className="flex gap-2">
                 {isEditMode ? (
                  <Button type="button" variant="ghost" onClick={handleTransferClick}>
                    Transférer en BR
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                  >
                    Annuler
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {isEditMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                  >
                    Fermer
                  </Button>
                )}
                <Button type="submit">
                  {isEditMode ? 'Enregistrer' : 'Créer le bon de commande'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <ArticleDialog
        isOpen={isArticleDialogOpen}
        onOpenChange={setArticleDialogOpen}
        onArticleCreated={handleArticleCreated}
    />
    </>
  );
}
