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
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from './ui/separator';
import { ArticleDialog } from './article-dialog';

const invoiceItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  price: z.number(),
});

const purchaseInvoiceSchema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  invoiceDate: z.string({ required_error: 'La date de facturation est requise.' }),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }),
  items: z.array(z.object({
      productId: z.string().nonempty("Veuillez sélectionner un article."),
      quantity: z.coerce.number().int().min(1, 'La quantité doit être au moins de 1.'),
  })).min(1, 'La facture doit contenir au moins un article.'),
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

export function PurchaseInvoiceDialog({
  purchaseOrders,
  suppliers,
  products,
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
  
  const isTriggeredExternally = openProp !== undefined;
  const isEditMode = !!invoice;
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;


  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
  });
  
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const purchaseOrderId = form.watch('purchaseOrderId');
  const supplierId = form.watch('supplierId');
  const watchedItems = form.watch('items');
  const [total, setTotal] = useState(0);

  const filteredProducts = useMemo(
    () => products.filter(p => p.supplierId === supplierId),
    [products, supplierId]
  )
  
  useEffect(() => {
    if (isOpen) {
        if (isEditMode && invoice) {
            form.reset({
                purchaseOrderId: invoice.purchaseOrderId,
                supplierId: invoice.supplierId,
                invoiceDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
                dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
                items: invoice.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
            });
        } else if (purchaseOrder) {
            form.reset({
                purchaseOrderId: purchaseOrder.id,
                supplierId: purchaseOrder.supplierId,
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
                items: purchaseOrder.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
            });
        } else {
            form.reset({
                purchaseOrderId: '',
                supplierId: '',
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
                items: [{ productId: '', quantity: 1 }],
            });
        }
    }
  }, [invoice, purchaseOrder, isEditMode, isOpen, form]);

  useEffect(() => {
    const po = purchaseOrders.find(o => o.id === purchaseOrderId);
    if (po) {
        form.setValue('supplierId', po.supplierId);
        form.setValue('items', po.items.map(item => ({ productId: item.productId, quantity: item.quantity })));
    } else if (!isEditMode) {
        // When PO is deselected, clear items if not in edit mode
        form.setValue('items', [{ productId: '', quantity: 1 }]);
    }
  }, [purchaseOrderId, purchaseOrders, form, isEditMode]);


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
    if (!firestore) return;

    const invoiceData = {
        purchaseOrderId: data.purchaseOrderId,
        supplierId: data.supplierId,
        invoiceDate: new Date(data.invoiceDate).toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
        items: data.items.map(item => ({
            ...item,
            price: filteredProducts?.find(p => p.id === item.productId)?.price || 0
        })),
        totalAmount: total,
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
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={isEditMode || !suppliers.length}>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={readOnly || fromBC}>
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

            <div className="space-y-4">
              <FormLabel>Articles</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                   <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field: itemField }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={itemField.onChange} value={itemField.value} disabled={!supplierId || fromBC || readOnly}>
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
                          <Input type="number" placeholder="Qté" className="w-24" {...itemField} disabled={fromBC || readOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   {!fromBC && !readOnly && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                   )}
                </div>
              ))}
               {supplierId && (!filteredProducts || filteredProducts.length === 0) && (
                <div className="text-sm text-muted-foreground p-2 text-center border border-dashed rounded-md">
                    Aucun article trouvé pour ce fournisseur.
                    <Button type="button" variant="link" className="p-1 h-auto" onClick={() => setArticleDialogOpen(true)}>Créer un article</Button>
                </div>
              )}
              {!fromBC && !readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1 })} disabled={!supplierId}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un article
                </Button>
              )}
            </div>

            <Separator />

            <div className="flex justify-end items-center space-x-4 pt-4">
                <span className="text-lg font-semibold">Total :</span>
                <span className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                    }).format(total)}
                </span>
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
