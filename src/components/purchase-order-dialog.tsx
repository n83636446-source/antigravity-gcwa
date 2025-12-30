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
import type { Product, PurchaseOrder, Supplier, Representative } from '@/lib/types';
import { Separator } from './ui/separator';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from '@/components/ui/label';

const orderItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.coerce.number().min(0, "Le prix doit être un nombre positif."),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseOrderSchema = z.object({
  orderNumber: z.string().nonempty("Le numéro de document est requis."),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  orderDate: z.string({ required_error: 'La date est requise.' }),
  items: z.array(orderItemSchema).min(1, 'Le bon de commande doit contenir au moins un article.'),
  paymentMode: z.string().optional(),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }).nonempty("La date d'échéance est requise."),
  representativeId: z.string().optional(),
  reference: z.string().optional(),
  remarks: z.string().optional(),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

type PurchaseOrderDialogProps = {
  suppliers: Supplier[];
  lastOrderNumber: number;
  onOrderCreated?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  order?: PurchaseOrder | null;
};

const CREATE_NEW_SUPPLIER_VALUE = '--create-new-supplier--';
const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';


export function PurchaseOrderDialog({
  suppliers: initialSuppliers,
  lastOrderNumber,
  onOrderCreated,
  isOpen: openProp,
  onOpenChange: onOpenChangeProp,
  order,
}: PurchaseOrderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isTriggeredExternally = openProp !== undefined;
  const isEditMode = !!order;
  
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);

  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;
  
  const suppliersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersRef);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: allProducts } = useCollection<Product>(productsRef);

  const representativesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'representatives') : null), [firestore]);
  const { data: representatives } = useCollection<Representative>(representativesRef);

  const products = allProducts || [];
  const suppliers = allSuppliers || initialSuppliers;
  
  const gridLayout = "grid grid-cols-[1fr_80px_100px_80px_120px_50px] gap-2 items-end text-left";

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

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      orderNumber: '',
      supplierId: '',
      orderDate: new Date().toISOString().split('T')[0],
      items: [],
      paymentMode: 'Espèces',
      dueDate: '',
      representativeId: '',
      reference: '',
      remarks: '',
    },
  });

  const { fields, replace, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  
  const liveTotals = useMemo(() => {
    const totalHT = watchedItems?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0) || 0;
    const totalTVA = watchedItems?.reduce((sum, item) => {
        const itemHT = (item.quantity || 0) * (item.price || 0);
        const tvaAmount = itemHT * ((item.tvaRate || 0) / 100);
        return sum + tvaAmount;
    }, 0) || 0;
    const totalTTC = totalHT + totalTVA;
    return { totalHT, totalTVA, totalTTC };
  }, [watchedItems]);


  useEffect(() => {
    if (!isOpen) {
      form.reset({
        orderNumber: '',
        supplierId: '',
        orderDate: new Date().toISOString().split('T')[0],
        items: [],
      });
      return;
    }
  
    if (isEditMode && order) {
      form.reset({
        orderNumber: order.orderNumber,
        supplierId: order.supplierId,
        orderDate: new Date(order.orderDate).toISOString().split('T')[0],
        items: order.items,
        paymentMode: order.paymentMode,
        dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : '',
        representativeId: order.representativeId,
        reference: order.reference,
        remarks: order.remarks,
      });
    } else {
       const newOrderNumber = `BC-${(lastOrderNumber + 1).toString().padStart(4, '0')}`;
       form.reset({
          orderNumber: newOrderNumber,
          supplierId: '',
          orderDate: new Date().toISOString().split('T')[0],
          items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }],
          paymentMode: 'Espèces',
          dueDate: '',
          representativeId: '',
          reference: '',
          remarks: '',
       });
    }
  }, [isOpen, isEditMode, order, form, lastOrderNumber]);

  const onSubmit = async (data: PurchaseOrderFormValues) => {
    if (!firestore) return;
    
    const { totalHT, totalTTC } = liveTotals;

    const orderData: Omit<PurchaseOrder, 'id'> = {
        orderNumber: data.orderNumber,
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
        updateDocumentNonBlocking(orderDocRef, orderData);
        toast({
            title: 'Bon de commande modifié',
            description: 'Les détails du bon de commande ont été mis à jour.',
        });

    } else {
        const orderRef = collection(firestore, 'purchaseOrders');
        addDocumentNonBlocking(orderRef, orderData)
          .then(() => {
             toast({
              title: 'Bon de commande créé',
              description: `Le BC "${data.orderNumber}" est enregistré.`,
            });
            onOrderCreated?.();
          })
          .catch((e) => {
             console.error(e);
             toast({
              variant: 'destructive',
              title: 'Erreur',
              description: 'Impossible de créer le bon de commande.',
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
        Créer un bon de commande
      </Button>
    </DialogTrigger>
  ) : null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {Trigger}
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
                        <FormField
                            control={form.control}
                            name="orderNumber"
                            render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-2">
                                <FormLabel className="text-right">Numéro</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: BC-0001" {...field} className="w-full" disabled />
                                </FormControl>
                                <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                            )}
                        />
                       <FormField
                          control={form.control}
                          name="orderDate"
                          render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-2">
                              <FormLabel className="text-right">Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="w-full" />
                              </FormControl>
                              <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                          )}
                        />
                    </div>
                </div>
                <div className="relative lg:col-span-8 space-y-2 rounded-md border border-blue-800 p-4 pt-6">
                    <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Fournisseur</h3>
                     <FormField
                          control={form.control}
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4 space-y-0">
                              <FormLabel className="text-right">Fournisseur</FormLabel>
                              <Select
                                onValueChange={handleSupplierChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className='w-full'>
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
                              <FormMessage className="col-span-2 col-start-2" />
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
                                <FormItem className="grid grid-cols-[110px_1fr] items-center gap-2">
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
                                <FormMessage className="col-span-2 col-start-2" />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-[110px_1fr] items-center gap-2">
                                <FormLabel className="text-right">Date d'échéance</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} className="w-full" />
                                </FormControl>
                                <FormMessage className="col-span-2 col-start-2" />
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
                <div className={cn('grid text-sm font-medium', "grid grid-cols-[1fr_120px_100px_80px_120px_50px] gap-2 items-end text-left")}>
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
                  <div key={field.id} className={cn("grid grid-cols-[1fr_120px_100px_80px_120px_50px] gap-2 items-end text-left")}>
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <Select onValueChange={(value) => handleProductChange(value, index)} value={itemField.value}>
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
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" placeholder="Qté" className="w-full" {...itemField} />
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
                              <Input type="number" placeholder="Prix UHT" className="w-full" value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
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
                              <Input type="number" placeholder="TVA" className="w-full" value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
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
                )
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, price: 0, tvaRate: 20 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne
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


            <DialogFooter className="sm:justify-end">
              <div className='flex gap-2'>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  {isEditMode ? 'Fermer' : 'Annuler'}
                </Button>
                <Button type="submit">{isEditMode ? 'Enregistrer les modifications' : 'Créer le bon de commande'}</Button>
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
