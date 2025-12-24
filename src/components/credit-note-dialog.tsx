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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Supplier, CreditNote, Product, CreditNoteItem } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { ArticleDialog } from './article-dialog';

const creditNoteItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.coerce.number().min(0, "Le prix doit être un nombre positif."),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const creditNoteSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur doit être sélectionné.'),
  creditNoteDate: z.string().nonempty("La date de l'avoir est requise."),
  reason: z.string().min(5, "La raison doit contenir au moins 5 caractères."),
  items: z.array(creditNoteItemSchema).min(1, "L'avoir doit contenir au moins un article."),
});

type CreditNoteFormValues = z.infer<typeof creditNoteSchema>;

type CreditNoteDialogProps = {
  suppliers: Supplier[];
  onCreditNoteCreated?: (creditNote: CreditNote) => void;
  lastCreditNoteNumber: number;
};

const CREATE_NEW_ARTICLE_VALUE = '--create-new-article--';

export function CreditNoteDialog({
  suppliers,
  onCreditNoteCreated,
  lastCreditNoteNumber,
}: CreditNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: products } = useCollection<Product>(productsRef);

  const form = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteSchema),
  });
  
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  
  const gridLayout = "grid grid-cols-[1fr_80px_100px_80px_120px_50px] gap-2 items-end text-left";
  
  const liveTotals = useMemo(() => {
    const totalHT = watchedItems?.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0) || 0;
    const totalTVA = watchedItems?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0) * (item.tvaRate || 0)) / 100, 0) || 0;
    const totalTTC = totalHT + totalTVA;
    return { totalHT, totalTVA, totalTTC };
  }, [watchedItems]);

  useEffect(() => {
    if (open) {
        form.reset({
            supplierId: '',
            creditNoteDate: new Date().toISOString().split('T')[0],
            reason: '',
            items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }],
        });
    }
  }, [open, form]);
  
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
      const index = articleCreationIndex.current;
      update(index, { 
        ...watchedItems[index],
        productId: newArticle.id,
        price: newArticle.price
      });
    }
    articleCreationIndex.current = null;
    setArticleDialogOpen(false);
  };


  const onSubmit = (data: CreditNoteFormValues) => {
    if (!firestore) return;
    
    const newCreditNoteNumber = `AV-${(lastCreditNoteNumber + 1)
      .toString()
      .padStart(4, '0')}`;
      
    const newCreditNoteData: Omit<CreditNote, 'id'> = {
      creditNoteNumber: newCreditNoteNumber,
      supplierId: data.supplierId,
      creditNoteDate: new Date(data.creditNoteDate).toISOString(),
      reason: data.reason,
      status: 'Brouillon',
      items: data.items,
      totalHT: liveTotals.totalHT,
      totalTTC: liveTotals.totalTTC,
    };

    const creditNotesRef = collection(firestore, 'creditNotes');
    addDocumentNonBlocking(creditNotesRef, newCreditNoteData);

    toast({
      title: 'Avoir créé',
      description: `L'avoir "${newCreditNoteNumber}" a été créé avec succès.`,
    });
    
    onCreditNoteCreated?.(newCreditNoteData as CreditNote);

    setOpen(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un avoir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Créer un avoir</DialogTitle>
              <DialogDescription>
                Remplissez les détails pour créer une nouvelle note de crédit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    name="creditNoteDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Date de l'avoir</FormLabel>
                        <FormControl>
                        <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
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
            
            <Separator />
            
            <div className="space-y-2">
                <div className={cn("grid text-sm font-medium", gridLayout)}>
                   <Label>Article</Label>
                   <div></div>
                   <Label>Qté</Label>
                   <Label>Prix</Label>
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
                          <FormItem className="col-span-2">
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
                              <Input type="number" step="0.01" placeholder="Prix" {...itemField} />
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


            <DialogFooter>
              <Button type="submit">Créer l'avoir</Button>
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
