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
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, PurchaseInvoice, Supplier, Product } from '@/lib/types';
import { addDays } from 'date-fns';
import { Input } from './ui/input';
import { useFirestore, updateDocumentNonBlocking, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from './ui/separator';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';

const invoiceItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.coerce.number().min(0, "Le prix doit être un nombre positif."),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseInvoiceSchema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  invoiceDate: z.string({ required_error: 'La date de facturation est requise.' }),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }),
  items: z.array(invoiceItemSchema).min(1, 'La facture doit contenir au moins un article.'),
});

type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

type PurchaseInvoiceDialogProps = {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  products: Product[];
  onInvoiceCreated?: (invoice: PurchaseInvoice) => void;
  lastInvoiceNumber: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder;
  invoice?: PurchaseInvoice | null;
};

const CREATE_NEW_SUPPLIER_VALUE = '--create-new-supplier--';
const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';

export function PurchaseInvoiceDialog({
  purchaseOrders,
  suppliers,
  products: initialProducts,
  onInvoiceCreated,
  lastInvoiceNumber,
  isOpen: openProp,
  onOpenChange: onOpenChangeProp,
  purchaseOrder,
  invoice,
}: PurchaseInvoiceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);

  const isTriggeredExternally = openProp !== undefined;
  const isEditMode = !!invoice;
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;
  
  const suppliersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersRef);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  const products = allProducts || initialProducts;

  const lastSupplierCodeNumber = useMemo(() => {
    if (!allSuppliers || allSuppliers.length === 0) return 0;
    return allSuppliers.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'FOU0').replace('FOU', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [allSuppliers]);

  const lastArticleCodeNumber = useMemo(() => {
    if (!products || products.length === 0) {
      return 0;
    }
    return products.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'ART0').replace('ART', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [products]);


  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
  });
  
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const purchaseOrderId = form.watch('purchaseOrderId');
  const watchedItems = useWatch({ control: form.control, name: "items" });
  
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
        if (isEditMode && invoice) {
            form.reset({
                purchaseOrderId: invoice.purchaseOrderId,
                supplierId: invoice.supplierId,
                invoiceDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
                dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
                items: invoice.items,
            });
        } else if (purchaseOrder) {
            form.reset({
                purchaseOrderId: purchaseOrder.id,
                supplierId: purchaseOrder.supplierId,
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
                items: purchaseOrder.items.map(item => ({ ...item })),
            });
        } else {
            form.reset({
                purchaseOrderId: '',
                supplierId: '',
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
                items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }],
            });
        }
    }
  }, [invoice, purchaseOrder, isEditMode, isOpen, form]);

  useEffect(() => {
    const po = purchaseOrders.find(o => o.id === purchaseOrderId);
    if (po) {
        form.setValue('supplierId', po.supplierId);
        form.setValue('items', po.items.map(item => ({ ...item })));
    } else if (!isEditMode && !purchaseOrderId) {
        // When PO is deselected, clear items if not in edit mode
        form.setValue('items', [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }]);
    }
  }, [purchaseOrderId, purchaseOrders, form, isEditMode]);


  useEffect(() => {
    if (!isOpen) {
      form.reset({
        purchaseOrderId: '',
        supplierId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
        items: [],
      });
    }
  }, [isOpen, form]);


  const onSubmit = (data: PurchaseInvoiceFormValues) => {
    if (!firestore || !products) return;

    const { totalHT, totalTTC } = liveTotals;

    const invoiceData = {
        purchaseOrderId: data.purchaseOrderId,
        supplierId: data.supplierId,
        invoiceDate: new Date(data.invoiceDate).toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
        items: data.items,
        totalHT,
        totalTTC,
    };

    if (isEditMode && invoice) {
        const invoiceDocRef = doc(firestore, 'purchaseInvoices', invoice.id);
        updateDocumentNonBlocking(invoiceDocRef, {
            ...invoiceData,
            status: invoice.status,
        });
        toast({
            title: 'Facture modifiée',
            description: `La facture "${invoice.invoiceNumber}" a été mise à jour.`,
        });
    } else {
        const newInvoiceNumber = `FA-${(lastInvoiceNumber + 1).toString().padStart(4, '0')}`;
        const newInvoiceData = {
            ...invoiceData,
            invoiceNumber: newInvoiceNumber,
            status: 'Brouillon' as const,
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
  
  const handleSupplierChange = (value: string) => {
    if (value === CREATE_NEW_SUPPLIER_VALUE) {
      setSupplierDialogOpen(true);
    } else {
      form.setValue('supplierId', value);
    }
  };

  const handleSupplierCreated = (newSupplier: Supplier) => {
    if(newSupplier && newSupplier.id) {
        // We need a slight delay to allow the `allSuppliers` collection to update
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
      const product = products?.find(p => p.id === value);
      update(index, { 
        ...watchedItems[index], 
        productId: value,
        price: product?.price || 0
      });
    }
  };

  const handleArticleCreated = (newArticle: Product) => {
    if (newArticle && newArticle.id && articleCreationIndex.current !== null) {
      // We need a slight delay to allow the `allProducts` collection to update
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
          Créer une facture
        </Button>
      </DialogTrigger>
  ) : null;
  
  const readOnly = isEditMode && invoice?.status !== 'Brouillon';
  const fromBC = !!purchaseOrderId || (isEditMode && !!invoice?.purchaseOrderId);


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {Trigger}
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Détails de la facture' : 'Créer une facture'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? `Consultez les détails de la facture ${invoice?.invoiceNumber}.` : "Créez une facture à partir d'un bon de commande ou manuellement."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="purchaseOrderId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bon de commande (Optionnel)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={readOnly || isTriggeredExternally}>
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
                    name="supplierId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fournisseur</FormLabel>
                        <Select onValueChange={handleSupplierChange} value={field.value} disabled={readOnly || fromBC}>
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
            </div>
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
                            <Select onValueChange={(value) => handleProductChange(value, index)} value={itemField.value} disabled={fromBC || readOnly}>
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
                            <Input type="number" placeholder="Qté" {...itemField} disabled={fromBC || readOnly} />
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
                            <Input type="number" step="0.01" placeholder="Prix UHT" {...itemField} disabled={fromBC || readOnly} />
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
                            <Input type="number" placeholder="TVA %" {...itemField} disabled={fromBC || readOnly} />
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
                       
                    {!fromBC && !readOnly && (
                        <div className="flex justify-center">
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="h-10 w-10">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    )}
                    </div>
                )
              })}
               {(!products || products.length === 0) && !isLoadingProducts && (
                <div className="text-sm text-muted-foreground p-2 text-center border border-dashed rounded-md">
                    Aucun article trouvé.
                    <Button type="button" variant="link" className="p-1 h-auto" onClick={() => setArticleDialogOpen(true)}>Créer un article</Button>
                </div>
              )}
              {!fromBC && !readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, price: 0, tvaRate: 20 })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un article
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
        suppliers={allSuppliers || []}
    />
    </>
  );
}
