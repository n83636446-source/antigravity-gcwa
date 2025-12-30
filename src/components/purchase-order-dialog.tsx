'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import type { Supplier, Product, PurchaseOrder, Representative } from '@/lib/types';
import { Separator } from './ui/separator';
import { ArticleDialog } from './article-dialog';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { addDays } from 'date-fns';

const orderItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.coerce.number().min(0, "Le prix doit être positif."),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur doit être sélectionné.'),
  orderDate: z.string({ required_error: 'La date est requise.' }),
  items: z.array(orderItemSchema).min(1, 'Le bon de commande doit contenir au moins un article.'),
  paymentMode: z.string().optional(),
  dueDate: z.string().optional(),
  representativeId: z.string().optional(),
  reference: z.string().optional(),
  remarks: z.string().optional(),
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

  const representativesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'representatives') : null), [firestore]);
  const { data: representatives } = useCollection<Representative>(representativesRef);

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: '',
      orderDate: new Date().toISOString().split('T')[0],
      items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }],
      paymentMode: 'Espèces',
      dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
      representativeId: '',
      reference: '',
      remarks: '',
    }
  });

  const { fields, append, remove, replace, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  const watchedItems = useWatch({
    control: form.control,
    name: 'items',
  });
  
  const gridLayout = "grid grid-cols-[1fr_80px_100px_80px_100px_50px] gap-3 items-end";

  const liveTotals = useMemo(() => {
    const totalHT = watchedItems?.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.price || 0));
    }, 0) || 0;

    const totalTVA = watchedItems?.reduce((sum, item) => {
        const itemHT = (item.quantity || 0) * (item.price || 0);
        const tvaAmount = itemHT * ((item.tvaRate || 0) / 100);
        return sum + tvaAmount;
    }, 0) || 0;
    
    const totalTTC = totalHT + totalTVA;

    return { totalHT, totalTVA, totalTTC };
  }, [watchedItems]);


  useEffect(() => {
    if (isOpen) {
        if (order) {
            form.reset({
                supplierId: order.supplierId,
                orderDate: new Date(order.orderDate).toISOString().split('T')[0],
                items: order.items.map(item => ({ 
                    productId: item.productId, 
                    quantity: item.quantity, 
                    price: item.price, 
                    tvaRate: item.tvaRate 
                })),
                paymentMode: order.paymentMode,
                dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : addDays(new Date(), 30).toISOString().split('T')[0],
                representativeId: order.representativeId,
                reference: order.reference,
                remarks: order.remarks,
            });
        } else {
            form.reset({
                supplierId: '',
                orderDate: new Date().toISOString().split('T')[0],
                items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }],
                paymentMode: 'Espèces',
                dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
                representativeId: '',
                reference: '',
                remarks: '',
            });
        }
    }
  }, [order, isOpen, form]);

  const newOrderNumber = `BC-${(lastOrderNumber + 1).toString().padStart(4, '0')}`;

  const onSubmit = async (data: PurchaseOrderFormValues) => {
    if (!firestore || !products) return;
    
    const { totalHT, totalTTC } = liveTotals;

    const orderData = {
        supplierId: data.supplierId,
        orderDate: new Date(data.orderDate).toISOString(),
        items: data.items,
        totalHT,
        totalTTC,
        paymentMode: data.paymentMode,
        dueDate: data.dueDate,
        representativeId: data.representativeId,
        reference: data.reference,
        remarks: data.remarks,
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
      const product = products?.find(p => p.id === value);
      update(index, { 
        ...fields[index],
        productId: value,
        price: product?.price || 0
      });
    }
  };

  const handleArticleCreated = (newArticle: Product) => {
    if (newArticle && newArticle.id && articleCreationIndex.current !== null) {
      const index = articleCreationIndex.current;
      update(index, { 
        ...fields[index],
        productId: newArticle.id,
        price: newArticle.price
      });
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
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier le' : 'Créer un'} bon de commande</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="relative lg:col-span-4 rounded-md border border-blue-800 p-4 pt-6">
                    <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Informations pièce</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                            <Label className="text-right">Numéro</Label>
                            <Input value={isEditMode ? order?.orderNumber : newOrderNumber} disabled className="w-full" />
                        </div>
                        <FormField
                            control={form.control}
                            name="orderDate"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4">
                                <FormLabel className="text-right">Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} className="w-full justify-start text-left font-normal" />
                                </FormControl>
                                <FormMessage className="col-start-2" />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
                <div className="relative lg:col-span-8 space-y-2 rounded-md border border-blue-800 p-4 pt-6">
                    <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Informations fournisseur</h3>
                    <FormField
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4">
                            <FormLabel className="text-right">Fournisseur</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
                                <FormControl>
                                <SelectTrigger className="w-full">
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
                            <FormMessage className='col-start-2' />
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="relative lg:col-span-4 rounded-md border border-blue-800 p-4 pt-6">
                    <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Règlement</h3>
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="paymentMode"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4">
                                <FormLabel className="text-right">Mode de paiement</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Mode de paiement" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="Espèces">Espèces</SelectItem>
                                    <SelectItem value="Chèque">Chèque</SelectItem>
                                    <SelectItem value="Virement">Virement</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-start-2" />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4">
                                <FormLabel className="text-right">Date d'échéance</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} className="w-full justify-start text-left font-normal" />
                                </FormControl>
                                <FormMessage className="col-start-2" />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
                <div className="relative lg:col-span-8 rounded-md border border-blue-800 p-4 pt-6 grid grid-cols-1 gap-4">
                    <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Détails</h3>
                    <FormField
                        control={form.control}
                        name="representativeId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4 space-y-0">
                            <FormLabel className="text-right">Représentant</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder="Représentant" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {(representatives || []).map(rep => (
                                    <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4 space-y-0">
                            <FormLabel className="text-right">Référence</FormLabel>
                            <FormControl>
                                <Input placeholder="Référence" {...field} className='w-full' />
                            </FormControl>
                            <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="remarks"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4 space-y-0">
                            <FormLabel className="text-right">Remarques</FormLabel>
                            <FormControl>
                                <Input placeholder="Remarques" {...field} className='w-full' />
                            </FormControl>
                            <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            <Separator />

            <div className="space-y-2">
                <div className={cn("text-sm font-medium", gridLayout)}>
                   <Label>Article</Label>
                   <Label>Qté</Label>
                   <Label>Prix UHT</Label>
                   <Label>TVA (%)</Label>
                   <Label className="text-right">Total HT</Label>
                   <div className="w-[50px]"></div>
                </div>

              {fields.map((field, index) => {
                  const item = watchedItems[index];
                  const lineTotal = (item?.quantity || 0) * (item?.price || 0);
                  return (
                    <div key={field.id} className={cn(gridLayout)}>
                      <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field: itemField }) => (
                          <FormItem>
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
                              <Input type="number" placeholder="Qté" {...itemField} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name={`items.${index}.price`}
                          render={({ field: itemField }) => (
                          <FormItem>
                              <FormControl>
                              <Input type="number" step="0.01" placeholder="Prix UHT" {...itemField} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name={`items.${index}.tvaRate`}
                          render={({ field: itemField }) => (
                          <FormItem>
                              <FormControl>
                              <Input type="number" placeholder="TVA %" {...itemField} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <Input
                        readOnly
                        disabled
                        value={new Intl.NumberFormat('fr-FR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        }).format(lineTotal)}
                        className="w-full text-right"
                       />
                       <div className="flex justify-center">
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="h-10 w-10">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                  );
              })}
               {(!products || products.length === 0) && (
                <div className="text-sm text-muted-foreground p-2 text-center border border-dashed rounded-md">
                    Aucun article trouvé.
                    <Button type="button" variant="link" className="p-1 h-auto" onClick={() => setArticleDialogOpen(true)}>Créer un article</Button>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, price: 0, tvaRate: 20 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un article
              </Button>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="text-right font-medium">Total HT:</div>
                <div className="text-right font-semibold">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(liveTotals.totalHT)}
                </div>

                <div className="text-right font-medium">Total TVA:</div>
                <div className="text-right font-semibold">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(liveTotals.totalTVA)}
                </div>

                <div className="text-right font-bold text-lg border-t pt-2 mt-1">Total TTC:</div>
                <div className="text-right font-bold text-lg text-primary border-t pt-2 mt-1">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(liveTotals.totalTTC)}
                </div>
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
