'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
import type { Product, PurchaseOrder, PurchaseReceipt, Supplier } from '@/lib/types';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from '@/components/ui/label';

const receiptItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantityOrdered: z.coerce.number().int().optional(),
  quantityReceived: z.coerce
    .number()
    .int()
    .min(0, 'La quantité doit être un entier non négatif.'),
  price: z.number().optional(),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseReceiptSchema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  receiptDate: z.string({ required_error: 'La date est requise.' }),
  notes: z.string().optional(),
  items: z.array(receiptItemSchema).min(1, 'Le bon de réception doit contenir au moins un article.'),
});

type PurchaseReceiptFormValues = z.infer<typeof purchaseReceiptSchema>;

type PurchaseReceiptDialogProps = {
  purchaseOrders: PurchaseOrder[];
  receipts: PurchaseReceipt[];
  products: Product[];
  suppliers: Supplier[];
  lastReceiptNumber: number;
  onReceiptCreated?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder | null;
  receipt?: PurchaseReceipt | null;
};

const CREATE_NEW_SUPPLIER_VALUE = '--create-new-supplier--';
const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';

const gridLayout = "grid grid-cols-[1fr_100px_100px_80px_50px] gap-3 items-end text-left";


export function PurchaseReceiptDialog({
  purchaseOrders,
  receipts,
  products: initialProducts,
  suppliers: initialSuppliers,
  lastReceiptNumber,
  onReceiptCreated,
  isOpen: openProp,
  onOpenChange: onOpenChangeProp,
  purchaseOrder,
  receipt,
}: PurchaseReceiptDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isTriggeredExternally = openProp !== undefined;
  const isEditMode = !!receipt;
  
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);

  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;
  
  const suppliersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersRef);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: allProducts } = useCollection<Product>(productsRef);

  const products = allProducts || initialProducts;
  const suppliers = allSuppliers || initialSuppliers;

  const lastSupplierCodeNumber = useMemo(() => {
    if (!suppliers || suppliers.length === 0) return 0;
    return suppliers.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'FOU0').replace('FOU', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [suppliers]);
  
  const lastArticleCodeNumber = useMemo(() => {
    if (!products || products.length === 0) {
      return 0;
    }
    return products.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'ART0').replace('ART', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [products]);


  // Filter out purchase orders that already have a receipt
  const availablePurchaseOrders = useMemo(() => {
    if (!receipts || !purchaseOrders) return [];
    const receivedOrderIds = new Set(receipts.map(r => r.purchaseOrderId));
    // When editing, allow the current receipt's PO to be in the list
    if (isEditMode && receipt?.purchaseOrderId) {
        receivedOrderIds.delete(receipt.purchaseOrderId);
    }
    return purchaseOrders.filter(o => !receivedOrderIds.has(o.id));
  }, [purchaseOrders, receipts, isEditMode, receipt]);


  const form = useForm<PurchaseReceiptFormValues>({
    resolver: zodResolver(purchaseReceiptSchema),
    defaultValues: {
      purchaseOrderId: '',
      supplierId: '',
      receiptDate: new Date().toISOString().split('T')[0],
      notes: '',
      items: [],
    },
  });

  const { fields, replace, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const watchedOrderId = form.watch('purchaseOrderId');
  const fromBC = !!watchedOrderId || (isEditMode && !!receipt?.purchaseOrderId);
  
  const liveTotals = useMemo(() => {
    const totalHT = watchedItems?.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        const price = item.price ?? product?.price ?? 0;
        return sum + ((item.quantityReceived || 0) * price);
    }, 0) || 0;

    const totalTVA = watchedItems?.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        const price = item.price ?? product?.price ?? 0;
        const itemHT = (item.quantityReceived || 0) * price;
        const tvaAmount = itemHT * ((item.tvaRate || 0) / 100);
        return sum + tvaAmount;
    }, 0) || 0;

    const totalTTC = totalHT + totalTVA;

    return { totalHT, totalTVA, totalTTC };
  }, [watchedItems, products]);


  useEffect(() => {
    if (!isOpen) {
      form.reset({
        purchaseOrderId: '',
        supplierId: '',
        receiptDate: new Date().toISOString().split('T')[0],
        notes: '',
        items: [],
      });
      return;
    }
  
    if (isEditMode && receipt) {
      const orderForReceipt = purchaseOrders.find(o => o.id === receipt.purchaseOrderId);
      form.reset({
        purchaseOrderId: receipt.purchaseOrderId,
        supplierId: receipt.supplierId,
        receiptDate: new Date(receipt.receiptDate).toISOString().split('T')[0],
        notes: receipt.notes || '',
        items: receipt.items.map(item => ({
          productId: item.productId,
          quantityOrdered: orderForReceipt?.items.find(i => i.productId === item.productId)?.quantity || 0,
          quantityReceived: item.quantityReceived,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
      });
    } else if (purchaseOrder) {
      // Case: Transfer from a specific PO
      form.reset({
        purchaseOrderId: purchaseOrder.id,
        supplierId: purchaseOrder.supplierId,
        receiptDate: new Date().toISOString().split('T')[0],
        notes: '',
        items: purchaseOrder.items.map(item => ({
          productId: item.productId,
          quantityOrdered: item.quantity,
          quantityReceived: item.quantity,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
      });
    } else {
      // Case: Creating a new BR from scratch or after selecting a PO in dialog
      const selectedPO = purchaseOrders.find(o => o.id === watchedOrderId);
      if (selectedPO) {
        form.setValue('supplierId', selectedPO.supplierId);
        replace(selectedPO.items.map(item => ({
            productId: item.productId,
            quantityOrdered: item.quantity,
            quantityReceived: item.quantity,
            price: item.price,
            tvaRate: item.tvaRate,
        })));
      } else {
         // Reset for manual creation
         form.reset({
            purchaseOrderId: '',
            supplierId: '',
            receiptDate: new Date().toISOString().split('T')[0],
            notes: '',
            items: [{ productId: '', quantityOrdered: 0, quantityReceived: 0, price: 0, tvaRate: 20 }],
         });
      }
    }
  }, [isOpen, isEditMode, receipt, purchaseOrder, watchedOrderId, purchaseOrders, form, replace]);


  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : 'Inconnu';
  };

  const onSubmit = async (data: PurchaseReceiptFormValues) => {
    if (!firestore) return;
    
    const { totalHT, totalTTC } = liveTotals;

    const receiptData = {
      purchaseOrderId: data.purchaseOrderId,
      supplierId: data.supplierId,
      receiptDate: new Date(data.receiptDate).toISOString(),
      notes: data.notes,
      items: data.items.map(({ productId, quantityReceived, tvaRate }) => {
        const product = products?.find(p => p.id === productId);
        return {
          productId,
          quantityReceived,
          price: product?.price ?? 0,
          tvaRate: tvaRate ?? 20,
        }
      }),
      totalHT: totalHT,
      totalTTC: totalTTC,
    };


    if (isEditMode && receipt) {
        const receiptDocRef = doc(firestore, 'purchaseReceipts', receipt.id);
        updateDocumentNonBlocking(receiptDocRef, {
            ...receiptData,
            status: receipt.status,
            totalHT: totalHT,
            totalTTC: totalTTC,
        });
        toast({
            title: 'Bon de réception modifié',
            description: 'Les détails du bon de réception ont été mis à jour.',
        });

    } else {
        const newReceiptNumber = `BR-${(lastReceiptNumber + 1)
          .toString()
          .padStart(4, '0')}`;

        const newReceiptData = {
          ...receiptData,
          receiptNumber: newReceiptNumber,
          status: 'Brouillon' as const,
        };

        const receiptRef = collection(firestore, 'purchaseReceipts');
        addDocumentNonBlocking(receiptRef, newReceiptData)
          .then((docRef) => {
             toast({
              title: 'Bon de réception créé',
              description: `Le BR "${newReceiptNumber}" est enregistré en brouillon.`,
            });
            onReceiptCreated?.();
          })
          .catch((e) => {
             console.error(e);
             toast({
              variant: 'destructive',
              title: 'Erreur',
              description: 'Impossible de créer le bon de réception.',
            });
          })
    }

    onOpenChange(false);
  };
  
  const handleSupplierChange = (value: string) => {
    if (value === CREATE_NEW_SUPPLIER_VALUE) {
      setSupplierDialogOpen(true);
    } else {
      form.setValue('supplierId', value);
    }
  };

  const handleSupplierCreated = (newSupplier: Supplier) => {
    if(newSupplier && newSupplier.id) {
        setTimeout(() => {
            form.setValue('supplierId', newSupplier.id);
        }, 100);
    }
    setSupplierDialogOpen(false);
  };

  const handleProductChange = (value: string, index: number) => {
    if (value === CREATE_NEW_ARTICLE_VALUE) {
      articleCreationIndex.current = index;
      setArticleDialogOpen(true);
    } else {
      const product = products.find(p => p.id === value);
      const currentItem = watchedItems[index];
      update(index, { 
          ...currentItem,
          productId: value,
          price: product?.price ?? 0 
      });
    }
  };

  const handleArticleCreated = (newArticle: Product) => {
    if (newArticle && newArticle.id && articleCreationIndex.current !== null) {
      const index = articleCreationIndex.current;
      setTimeout(() => {
        update(index, { 
            ...watchedItems[index], 
            productId: newArticle.id,
            price: newArticle.price
        });
      }, 100);
    }
    articleCreationIndex.current = null;
    setArticleDialogOpen(false);
  };
  
  const Trigger = !isTriggeredExternally ? (
    <DialogTrigger asChild>
      <Button>
        <PlusCircle className="mr-2 h-4 w-4" />
        Créer un bon de réception
      </Button>
    </DialogTrigger>
  ) : null;
  
  const readOnly = isEditMode && receipt?.status === 'Validé';


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {Trigger}
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier le' : 'Créer un'} bon de réception</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Modifiez les informations du bon de réception.' : "Créez un bon de réception à partir d'un bon de commande existant ou manuellement."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchaseOrderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bon de commande (Optionnel)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isTriggeredExternally || isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un bon de commande" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availablePurchaseOrders.map((order) => (
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
                      <Input type="date" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <Select
                      onValueChange={handleSupplierChange}
                      value={field.value}
                      disabled={readOnly || fromBC}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un fournisseur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={CREATE_NEW_SUPPLIER_VALUE}>
                          <div className="flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            <span>Créer un nouveau fournisseur</span>
                          </div>
                        </SelectItem>
                        <Separator />
                        {suppliers?.map((supplier) => (
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

            <Separator />

            <div className="space-y-2">
                <div className={cn('grid text-sm font-medium', gridLayout)}>
                   <Label>Article</Label>
                   {fromBC && <Label>Qté Cmdée</Label>}
                   <Label>Qté Reçue</Label>
                   <Label>Prix</Label>
                   <Label>TVA (%)</Label>
                   <div className="w-[50px]"></div>
                </div>
              {fields.map((field, index) => (
                <div key={field.id} className={cn(gridLayout)}>
                  {fromBC ? (
                    <p className="text-sm font-medium h-10 flex items-center">{getProductName(field.productId)}</p>
                  ) : (
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <Select onValueChange={(value) => handleProductChange(value, index)} value={itemField.value} disabled={readOnly}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Article" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={CREATE_NEW_ARTICLE_VALUE}>
                                <div className="flex items-center gap-2">
                                  <PlusCircle className="h-4 w-4" />
                                  <span>Créer un article</span>
                                </div>
                              </SelectItem>
                              <Separator />
                              {products?.map((product) => (
                                <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {fromBC && (
                      <Input
                        type="number"
                        readOnly
                        disabled
                        value={field.quantityOrdered}
                        className="w-full"
                      />
                  )}

                  <FormField
                    control={form.control}
                    name={`items.${index}.quantityReceived`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" placeholder="Qté reçue" className="w-full" disabled={readOnly} {...itemField} />
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
                            <Input type="number" placeholder="Prix" className="w-full" disabled={readOnly || fromBC} value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
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
                            <Input type="number" placeholder="TVA" className="w-full" disabled={readOnly || fromBC} value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
                          </FormControl>
                           <FormMessage />
                        </FormItem>
                      )}
                    />

                  {!fromBC && !readOnly && (
                     <div className="flex justify-center">
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="h-10 w-10">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                  )}
                </div>
              ))}
              {!fromBC && !readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantityReceived: 0, quantityOrdered: 0, price: 0, tvaRate: 20 })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne
                </Button>
              )}
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


            <DialogFooter className="sm:justify-end">
              <div className='flex gap-2'>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  {readOnly ? 'Fermer' : 'Annuler'}
                </Button>
                {!readOnly && (
                  <Button type="submit">{isEditMode ? 'Enregistrer' : 'Créer le bon de réception'}</Button>
                )}
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
      lastArticleCodeNumber={lastArticleCodeNumber}
    />
    <SupplierDialog
      isOpen={isSupplierDialogOpen}
      onOpenChange={setSupplierDialogOpen}
      lastSupplierCodeNumber={lastSupplierCodeNumber}
      onSupplierCreated={handleSupplierCreated}
      suppliers={suppliers || []}
    />
    </>
  );
}
