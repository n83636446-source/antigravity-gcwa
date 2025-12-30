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
import type { Product, Supplier, Representative, CreditNote } from '@/lib/types';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from '@/components/ui/label';

const creditNoteItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.coerce.number().min(0, "Le prix doit être un nombre positif."),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const creditNoteSchema = z.object({
  creditNoteNumber: z.string().nonempty("Le numéro de document est requis."),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  creditNoteDate: z.string({ required_error: 'La date est requise.' }),
  reason: z.string().min(5, "La raison doit contenir au moins 5 caractères."),
  items: z.array(creditNoteItemSchema).min(1, "L'avoir doit contenir au moins un article."),
  paymentMode: z.string().optional(),
  dueDate: z.string().optional(),
  representativeId: z.string().optional(),
  reference: z.string().optional(),
  remarks: z.string().optional(),
});

type CreditNoteFormValues = z.infer<typeof creditNoteSchema>;

type PurchaseCreditNoteDialogProps = {
  suppliers: Supplier[];
  lastCreditNoteNumber: number;
  onCreditNoteCreated?: () => void;
};

const CREATE_NEW_SUPPLIER_VALUE = '--create-new-supplier--';
const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';


export function CreditNoteDialog({
  suppliers: initialSuppliers,
  lastCreditNoteNumber,
  onCreditNoteCreated,
}: PurchaseCreditNoteDialogProps) {
  const [isOpen, setOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);
  
  const suppliersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersRef);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: allProducts } = useCollection<Product>(productsRef);

  const representativesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'representatives') : null), [firestore]);
  const { data: representatives } = useCollection<Representative>(representativesRef);

  const products = allProducts || [];
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

  const form = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      creditNoteNumber: '',
      supplierId: '',
      creditNoteDate: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      paymentMode: 'Espèces',
      dueDate: '',
      representativeId: '',
      reference: '',
      remarks: '',
    },
  });

  const { fields, append, remove, update } = useFieldArray({
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
        creditNoteNumber: '',
        supplierId: '',
        creditNoteDate: new Date().toISOString().split('T')[0],
        reason: '',
        items: [],
      });
      return;
    }
  
    const newCreditNoteNumber = `AV-${(lastCreditNoteNumber + 1).toString().padStart(4, '0')}`;
     form.reset({
        creditNoteNumber: newCreditNoteNumber,
        supplierId: '',
        creditNoteDate: new Date().toISOString().split('T')[0],
        reason: '',
        items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }],
        paymentMode: 'Espèces',
        dueDate: '',
        representativeId: '',
        reference: '',
        remarks: '',
     });
    
  }, [isOpen, form, lastCreditNoteNumber]);

  const onSubmit = async (data: CreditNoteFormValues) => {
    if (!firestore) return;
    
    const { totalHT, totalTTC } = liveTotals;

    const creditNoteData: Omit<CreditNote, 'id'> = {
        creditNoteNumber: data.creditNoteNumber,
        supplierId: data.supplierId,
        creditNoteDate: new Date(data.creditNoteDate).toISOString(),
        reason: data.reason,
        items: data.items,
        status: 'Brouillon',
        totalHT,
        totalTTC,
        paymentMode: data.paymentMode,
        dueDate: data.dueDate,
        representativeId: data.representativeId,
        reference: data.reference,
        remarks: data.remarks,
    };
    
    const creditNoteRef = collection(firestore, 'creditNotes');
    addDocumentNonBlocking(creditNoteRef, creditNoteData)
      .then(() => {
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
          description: "Impossible de créer l'avoir.",
        });
      })

    setOpen(false);
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

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Créer un avoir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Créer un avoir fournisseur</DialogTitle>
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
                            name="creditNoteNumber"
                            render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4">
                                <FormLabel className="text-right">Numéro</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: AV-0001" {...field} className="w-full" disabled />
                                </FormControl>
                                <FormMessage className="col-span-2 col-start-2" />
                            </FormItem>
                            )}
                        />
                       <FormField
                          control={form.control}
                          name="creditNoteDate"
                          render={({ field }) => (
                            <FormItem className="grid grid-cols-[110px_1fr] items-center gap-4">
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

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ex: Retour de marchandises endommagées" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
                                <FormMessage className="col-span-2 col-start-2" />
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
                <div className={cn('grid text-sm font-medium', gridLayout)}>
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
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit">Créer l'avoir</Button>
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
