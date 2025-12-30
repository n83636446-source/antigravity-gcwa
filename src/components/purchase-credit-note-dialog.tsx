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
import type { Product, PurchaseInvoice, PurchaseCreditNote, Supplier, Representative } from '@/lib/types';
import { Separator } from './ui/separator';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from '@/components/ui/label';

const creditNoteItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.coerce.number().optional(),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseCreditNoteSchema = z.object({
  creditNoteNumber: z.string().nonempty("Le numéro de document est requis."),
  purchaseInvoiceId: z.string().optional(),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  creditNoteDate: z.string({ required_error: 'La date est requise.' }),
  items: z.array(creditNoteItemSchema).min(1, "L'avoir doit contenir au moins un article."),
  reason: z.string().optional(),
  remarks: z.string().optional(),
});

type PurchaseCreditNoteFormValues = z.infer<typeof purchaseCreditNoteSchema>;

type PurchaseCreditNoteDialogProps = {
  purchaseInvoices: PurchaseInvoice[];
  creditNotes: PurchaseCreditNote[];
  products: Product[];
  suppliers: Supplier[];
  lastCreditNoteNumber: number;
  onCreditNoteCreated?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  purchaseInvoice?: PurchaseInvoice | null;
  creditNote?: PurchaseCreditNote | null;
};

const CREATE_NEW_SUPPLIER_VALUE = '--create-new-supplier--';
const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';


export function PurchaseCreditNoteDialog({
  purchaseInvoices,
  creditNotes,
  products: initialProducts,
  suppliers: initialSuppliers,
  lastCreditNoteNumber,
  onCreditNoteCreated,
  isOpen: openProp,
  onOpenChange: onOpenChangeProp,
  purchaseInvoice,
  creditNote,
}: PurchaseCreditNoteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isTriggeredExternally = openProp !== undefined;
  const isEditMode = !!creditNote;
  
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


  const products = allProducts || initialProducts;
  const suppliers = allSuppliers || initialSuppliers;
  
  const gridLayout = "grid grid-cols-[1fr_120px_100px_80px_120px_50px] gap-2 items-end text-left";


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

  const form = useForm<PurchaseCreditNoteFormValues>({
    resolver: zodResolver(purchaseCreditNoteSchema),
    defaultValues: {
      creditNoteNumber: '',
      purchaseInvoiceId: '',
      supplierId: '',
      creditNoteDate: new Date().toISOString().split('T')[0],
      items: [],
      reason: '',
      remarks: '',
    },
  });

  const { fields, replace, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const watchedInvoiceId = form.watch('purchaseInvoiceId');
  const fromInvoice = !!watchedInvoiceId || (isEditMode && !!creditNote?.purchaseInvoiceId);
  
  const liveTotals = useMemo(() => {
    const totalHT = watchedItems?.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        const price = item.price ?? product?.price ?? 0;
        return sum + ((item.quantity || 0) * price);
    }, 0) || 0;

    const totalTVA = watchedItems?.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        const price = item.price ?? product?.price ?? 0;
        const itemHT = (item.quantity || 0) * price;
        const tvaAmount = itemHT * ((item.tvaRate || 0) / 100);
        return sum + tvaAmount;
    }, 0) || 0;

    const totalTTC = totalHT + totalTVA;

    return { totalHT, totalTVA, totalTTC };
  }, [watchedItems, products]);


  useEffect(() => {
    if (!isOpen) {
      form.reset({
        creditNoteNumber: '',
        purchaseInvoiceId: '',
        supplierId: '',
        creditNoteDate: new Date().toISOString().split('T')[0],
        items: [],
      });
      return;
    }
  
    if (isEditMode && creditNote) {
      form.reset({
        creditNoteNumber: creditNote.creditNoteNumber,
        purchaseInvoiceId: creditNote.purchaseInvoiceId,
        supplierId: creditNote.supplierId,
        creditNoteDate: new Date(creditNote.creditNoteDate).toISOString().split('T')[0],
        items: creditNote.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
        reason: creditNote.reason,
        remarks: creditNote.remarks,
      });
    } else if (purchaseInvoice) {
      const newCreditNoteNumber = `AV-${(lastCreditNoteNumber + 1).toString().padStart(4, '0')}`;
      form.reset({
        creditNoteNumber: newCreditNoteNumber,
        purchaseInvoiceId: purchaseInvoice.id,
        supplierId: purchaseInvoice.supplierId,
        creditNoteDate: new Date().toISOString().split('T')[0],
        items: purchaseInvoice.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
        reason: '',
        remarks: purchaseInvoice.remarks,
      });
    } else {
      const newCreditNoteNumber = `AV-${(lastCreditNoteNumber + 1).toString().padStart(4, '0')}`;
      const selectedInvoice = purchaseInvoices.find(o => o.id === watchedInvoiceId);
      if (selectedInvoice) {
        form.setValue('supplierId', selectedInvoice.supplierId);
        replace(selectedInvoice.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            tvaRate: item.tvaRate,
        })));
      } else {
         form.reset({
            creditNoteNumber: newCreditNoteNumber,
            purchaseInvoiceId: '',
            supplierId: '',
            creditNoteDate: new Date().toISOString().split('T')[0],
            items: [{ productId: '', quantity: 0, price: 0, tvaRate: 20 }],
            reason: '',
            remarks: '',
         });
      }
    }
  }, [isOpen, isEditMode, creditNote, purchaseInvoice, watchedInvoiceId, purchaseInvoices, form, replace, lastCreditNoteNumber]);


  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : 'Inconnu';
  };

  const onSubmit = async (data: PurchaseCreditNoteFormValues) => {
    if (!firestore) return;

    if (!isEditMode && creditNotes) {
        const creditNoteExists = creditNotes.some(
          (r) => r.creditNoteNumber === data.creditNoteNumber
        );
        if (creditNoteExists) {
          form.setError('creditNoteNumber', {
            type: 'manual',
            message: 'Ce numéro de document est déjà utilisé.',
          });
          return;
        }
    }
    
    const { totalHT, totalTTC } = liveTotals;

    const creditNoteData: Omit<PurchaseCreditNote, 'id'> = {
        creditNoteNumber: data.creditNoteNumber,
        purchaseInvoiceId: data.purchaseInvoiceId,
        supplierId: data.supplierId,
        creditNoteDate: new Date(data.creditNoteDate).toISOString(),
        items: data.items.map(({ productId, quantity, price, tvaRate }) => ({
            productId,
            quantity,
            price: price ?? 0,
            tvaRate: tvaRate ?? 20,
        })),
        totalHT,
        totalTTC,
        reason: data.reason,
        remarks: data.remarks,
    };
    

    if (isEditMode && creditNote) {
        const creditNoteDocRef = doc(firestore, 'purchaseCreditNotes', creditNote.id);
        updateDocumentNonBlocking(creditNoteDocRef, creditNoteData);
        toast({
            title: 'Avoir modifié',
            description: 'Les détails de l\'avoir ont été mis à jour.',
        });

    } else {
        const creditNoteRef = collection(firestore, 'purchaseCreditNotes');
        addDocumentNonBlocking(creditNoteRef, creditNoteData)
          .then((docRef) => {
             toast({
              title: 'Avoir créé',
              description: `L'avoir "${data.creditNoteNumber}" est enregistré.`,
            });
            onCreditNoteCreated?.();
          })
          .catch((e) => {
             console.error(e);
             toast({
              variant: 'destructive',
              title: 'Erreur',
              description: 'Impossible de créer l\'avoir.',
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
      <Button data-dialog-trigger="true">
        <PlusCircle className="mr-2 h-4 w-4" />
        Créer un avoir fournisseur
      </Button>
    </DialogTrigger>
  ) : null;
  
  const readOnly = false; // A credit note can usually be edited. Add logic if needed.

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {Trigger}
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier l\'' : 'Créer un '}avoir fournisseur</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Modifiez les informations de l\'avoir.' : "Créez un avoir à partir d'une facture existante ou manuellement."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="relative lg:col-span-4 rounded-md border border-black p-4 pt-6">
                    <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Informations pièce</h3>
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="creditNoteNumber"
                            render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-2">
                                <FormLabel className="text-right">Numéro</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: AV-0001" {...field} className="w-full border-black" disabled={readOnly} />
                                </FormControl>
                                <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                            )}
                        />
                       <FormField
                          control={form.control}
                          name="creditNoteDate"
                          render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-2">
                              <FormLabel className="text-right">Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} disabled={readOnly} className="w-full border-black" />
                              </FormControl>
                              <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                          )}
                        />
                    </div>
                </div>
                <div className="relative lg:col-span-8 space-y-2 rounded-md border border-black p-4 pt-6">
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
                                disabled={readOnly || fromInvoice}
                              >
                                <FormControl>
                                  <SelectTrigger className='w-full border-black'>
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

            <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Raison</FormLabel>
                    <FormControl>
                        <Input placeholder="Ex: Retour de marchandise" {...field} disabled={readOnly} className='w-full border-black' />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Remarques</FormLabel>
                    <FormControl>
                        <Input placeholder="Remarques" {...field} disabled={readOnly} className='w-full border-black' />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <Separator />

            <div className="space-y-2">
                <div className={cn('grid text-sm font-medium', gridLayout)}>
                   <Label>Article</Label>
                   <Label>Qté</Label>
                   <Label>Prix UHT</Label>
                   <Label>TVA (%)</Label>
                   <Label className="text-right">Total HT</Label>
                   {!fromInvoice && !readOnly && <div className="w-[50px]"></div>}
                </div>
              {fields.map((field, index) => {
                const item = watchedItems[index];
                const lineTotal = (item?.quantity || 0) * (item?.price || 0);

                return (
                  <div key={field.id} className={cn(gridLayout)}>
                    {fromInvoice ? (
                      <p className="text-sm font-medium h-10 flex items-center">{getProductName(field.productId)}</p>
                    ) : (
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field: itemField }) => (
                          <FormItem>
                            <Select onValueChange={(value) => handleProductChange(value, index)} value={itemField.value} disabled={readOnly}>
                              <FormControl>
                                <SelectTrigger className='border-black'>
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

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" placeholder="Qté" className="w-full border-black" disabled={readOnly} {...itemField} />
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
                              <Input type="number" placeholder="Prix UHT" className="w-full border-black" disabled={readOnly || fromInvoice} value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
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
                              <Input type="number" placeholder="TVA" className="w-full border-black" disabled={readOnly || fromInvoice} value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
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
                      className="w-full text-right border-black"
                    />

                    {!fromInvoice && !readOnly && (
                      <div className="flex justify-center">
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="h-10 w-10">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                    )}
                  </div>
                )
              })}
              {!fromInvoice && !readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 0, price: 0, tvaRate: 20 })}>
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
                  Annuler
                </Button>
                {!readOnly && (
                  <Button type="submit">{isEditMode ? 'Enregistrer' : "Créer l'avoir"}</Button>
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
