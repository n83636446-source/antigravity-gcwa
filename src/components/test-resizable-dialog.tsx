'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, PurchaseOrder, PurchaseReceipt, Supplier, Representative } from '@/lib/types';
import { Separator } from './ui/separator';
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
  price: z.coerce.number().optional(),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseReceiptSchema = z.object({
  receiptNumber: z.string().nonempty("Le numéro de document est requis."),
  purchaseOrderId: z.string().optional(),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  receiptDate: z.string({ required_error: 'La date est requise.' }),
  items: z.array(receiptItemSchema).min(1, 'Le bon de réception doit contenir au moins un article.'),
  paymentMode: z.string().optional(),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }).nonempty("La date d'échéance est requise."),
  representativeId: z.string().optional(),
  reference: z.string().optional(),
  remarks: z.string().optional(),
});

type PurchaseReceiptFormValues = z.infer<typeof purchaseReceiptSchema>;

type TestResizableDialogProps = {
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


export function TestResizableDialog({
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
}: TestResizableDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!receipt;
  
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);

  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;
  
  const [size, setSize] = useState({ width: 1000, height: 800 });
  const isResizing = useRef(false);

  const minWidth = 350;
  const minHeight = 400;
  
  const isMobile = size.width < 900;

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    setSize(prev => ({
      width: Math.max(minWidth, prev.width + e.movementX),
      height: Math.max(minHeight, prev.height + e.movementY),
    }));
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResizing);
  }, [handleResize]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
  };
  
    const handleResizeY = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    setSize(prev => ({
      ...prev,
      height: Math.max(minHeight, prev.height + e.movementY),
    }));
  }, []);

  const handleResizeX = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    setSize(prev => ({
      ...prev,
      width: Math.max(minWidth, prev.width + e.movementX),
    }));
  }, []);

  const startResizingX = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleResizeX);
    window.addEventListener('mouseup', () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleResizeX);
    });
  };

  const startResizingY = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleResizeY);
    window.addEventListener('mouseup', () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleResizeY);
    });
  };

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
      receiptNumber: '',
      purchaseOrderId: '',
      supplierId: '',
      receiptDate: new Date().toISOString().split('T')[0],
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
        receiptNumber: '',
        purchaseOrderId: '',
        supplierId: '',
        receiptDate: new Date().toISOString().split('T')[0],
        items: [],
      });
      return;
    }
  
    if (isEditMode && receipt) {
      const orderForReceipt = purchaseOrders.find(o => o.id === receipt.purchaseOrderId);
      form.reset({
        receiptNumber: receipt.receiptNumber,
        purchaseOrderId: receipt.purchaseOrderId,
        supplierId: receipt.supplierId,
        receiptDate: new Date(receipt.receiptDate).toISOString().split('T')[0],
        items: receipt.items.map(item => ({
          productId: item.productId,
          quantityOrdered: orderForReceipt?.items.find(i => i.productId === item.productId)?.quantity || 0,
          quantityReceived: item.quantityReceived,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
        paymentMode: receipt.paymentMode,
        dueDate: receipt.dueDate ? new Date(receipt.dueDate).toISOString().split('T')[0] : '',
        representativeId: receipt.representativeId,
        reference: receipt.reference,
        remarks: receipt.remarks,
      });
    } else if (purchaseOrder) {
      // Case: Transfer from a specific PO
      const newReceiptNumber = `BR-${(lastReceiptNumber + 1).toString().padStart(4, '0')}`;
      form.reset({
        receiptNumber: newReceiptNumber,
        purchaseOrderId: purchaseOrder.id,
        supplierId: purchaseOrder.supplierId,
        receiptDate: new Date().toISOString().split('T')[0],
        items: purchaseOrder.items.map(item => ({
          productId: item.productId,
          quantityOrdered: item.quantity,
          quantityReceived: item.quantity,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
        paymentMode: purchaseOrder.paymentMode,
        dueDate: purchaseOrder.dueDate ? new Date(purchaseOrder.dueDate).toISOString().split('T')[0] : '',
        representativeId: purchaseOrder.representativeId,
        reference: purchaseOrder.reference,
        remarks: purchaseOrder.remarks,
      });
    } else {
      // Case: Creating a new BR from scratch or after selecting a PO in dialog
      const newReceiptNumber = `BR-${(lastReceiptNumber + 1).toString().padStart(4, '0')}`;
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
            receiptNumber: newReceiptNumber,
            purchaseOrderId: '',
            supplierId: '',
            receiptDate: new Date().toISOString().split('T')[0],
            items: [{ productId: '', quantityOrdered: 0, quantityReceived: 0, price: 0, tvaRate: 20 }],
            paymentMode: 'Espèces',
            dueDate: '',
            representativeId: '',
            reference: '',
            remarks: '',
         });
      }
    }
  }, [isOpen, isEditMode, receipt, purchaseOrder, watchedOrderId, purchaseOrders, form, replace, lastReceiptNumber]);


  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : 'Inconnu';
  };

  const onSubmit = async (data: PurchaseReceiptFormValues) => {
    if (!firestore) return;

    if (!isEditMode) {
        const receiptExists = receipts.some(
          (r) => r.receiptNumber === data.receiptNumber
        );
        if (receiptExists) {
          form.setError('receiptNumber', {
            type: 'manual',
            message: 'Ce numéro de document est déjà utilisé.',
          });
          return;
        }
    }
    
    const { totalHT, totalTTC } = liveTotals;

    const receiptData: Omit<PurchaseReceipt, 'id' | 'status'> = {
        receiptNumber: data.receiptNumber,
        purchaseOrderId: data.purchaseOrderId,
        supplierId: data.supplierId,
        receiptDate: new Date(data.receiptDate).toISOString(),
        items: data.items.map(({ productId, quantityReceived, price, tvaRate }) => ({
            productId,
            quantityReceived,
            price: price ?? 0,
            tvaRate: tvaRate ?? 20,
        })),
        totalHT,
        totalTTC,
        paymentMode: data.paymentMode,
        dueDate: data.dueDate,
        representativeId: data.representativeId,
        reference: data.reference,
        remarks: data.remarks,
    };
    

    if (isEditMode && receipt) {
        const receiptDocRef = doc(firestore, 'purchaseReceipts', receipt.id);
        updateDocumentNonBlocking(receiptDocRef, {
            ...receiptData,
            status: receipt.status, // Preserve current status on edit
        });
        toast({
            title: 'Bon de réception modifié',
            description: 'Les détails du bon de réception ont été mis à jour.',
        });

    } else {
        const newReceiptData = {
          ...receiptData,
          status: 'Brouillon' as const,
        };

        const receiptRef = collection(firestore, 'purchaseReceipts');
        addDocumentNonBlocking(receiptRef, newReceiptData)
          .then((docRef) => {
             toast({
              title: 'Bon de réception créé',
              description: `Le BR "${data.receiptNumber}" est enregistré en brouillon.`,
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
  
  const readOnly = isEditMode && receipt?.status === 'Validé';


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        style={{ width: size.width, height: size.height }}
        className="sm:max-w-none p-0 flex flex-col overflow-x-hidden"
      >
          <div 
            className="w-full h-full flex flex-col"
          >
            <div className='flex-shrink-0 p-6'>
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Modifier le' : 'Créer un'} bon de réception</DialogTitle>
                <DialogDescription>
                  {isEditMode ? 'Modifiez les informations du bon de réception.' : "Créez un bon de réception à partir d'un bon de commande existant ou manuellement."}
                </DialogDescription>
              </DialogHeader>
            </div>
          
            <div className="flex-grow overflow-auto px-6">
              <Form {...form}>
                <form id="resizable-dialog-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-5 px-1">

                  <div className={cn("grid gap-4 mb-6", isMobile ? "grid-cols-1" : "grid-cols-12")}>
                      <div className={cn("relative rounded-md border border-blue-800 p-4 pt-6", isMobile ? "col-span-1" : "col-span-4")}>
                          <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Informations pièce</h3>
                          <div className="space-y-4">
                              <FormField
                                  control={form.control}
                                  name="receiptNumber"
                                  render={({ field }) => (
                                    <FormItem className={cn("grid items-center gap-2", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                        <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Numéro</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: BR-0001" {...field} className="w-full" disabled={readOnly} />
                                        </FormControl>
                                        <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                    </FormItem>
                                  )}
                              />
                            <FormField
                                control={form.control}
                                name="receiptDate"
                                render={({ field }) => (
                                  <FormItem className={cn("grid items-center gap-2", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                    <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Date</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} disabled={readOnly} className="w-full" />
                                    </FormControl>
                                    <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                  </FormItem>
                                )}
                              />
                          </div>
                      </div>
                      <div className={cn("relative space-y-2 rounded-md border border-blue-800 p-4 pt-6", isMobile ? "col-span-1" : "col-span-8")}>
                          <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Fournisseur</h3>
                          <FormField
                                control={form.control}
                                name="supplierId"
                                render={({ field }) => (
                                  <FormItem className={cn("grid items-center gap-4 space-y-0", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                    <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Fournisseur</FormLabel>
                                    <Select
                                      onValueChange={handleSupplierChange}
                                      value={field.value}
                                      disabled={readOnly || fromBC}
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
                                    <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                  </FormItem>
                                )}
                              />
                      </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-12")}>
                      <div className={cn("relative rounded-md border border-blue-800 p-4 pt-6", isMobile ? "col-span-1" : "col-span-4")}>
                          <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Règlement</h3>
                          <div className="space-y-4">
                              <FormField
                                  control={form.control}
                                  name="paymentMode"
                                  render={({ field }) => (
                                      <FormItem className={cn("grid items-center gap-2", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                      <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Mode de paiement</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={readOnly} >
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
                                      <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                      </FormItem>
                                  )}
                              />
                              <FormField
                                  control={form.control}
                                  name="dueDate"
                                  render={({ field }) => (
                                      <FormItem className={cn("grid items-center gap-2", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                      <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Date d'échéance</FormLabel>
                                      <FormControl>
                                          <Input type="date" {...field} disabled={readOnly} className="w-full" />
                                      </FormControl>
                                      <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                      </FormItem>
                                  )}
                              />
                          </div>
                      </div>
                      <div className={cn("relative grid grid-cols-1 gap-4 rounded-md border border-blue-800 p-4 pt-6", isMobile ? "col-span-1" : "col-span-8")}>
                          <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-medium text-muted-foreground">Détails</h3>
                          <FormField
                              control={form.control}
                              name="representativeId"
                              render={({ field }) => (
                                  <FormItem className={cn("grid items-center gap-4 space-y-0", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                  <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Représentant</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={readOnly}>
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
                                  <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name="reference"
                              render={({ field }) => (
                                  <FormItem className={cn("grid items-center gap-4 space-y-0", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                  <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Référence</FormLabel>
                                  <FormControl>
                                      <Input placeholder="Référence" {...field} disabled={readOnly} className='w-full' />
                                  </FormControl>
                                  <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name="remarks"
                              render={({ field }) => (
                                  <FormItem className={cn("grid items-center gap-4 space-y-0", isMobile ? "grid-cols-1 items-start gap-1" : "grid-cols-[110px_1fr]")}>
                                  <FormLabel className={cn("font-medium", isMobile ? "text-left" : "text-right")}>Remarques</FormLabel>
                                  <FormControl>
                                      <Input placeholder="Remarques" {...field} disabled={readOnly} className='w-full' />
                                  </FormControl>
                                  <FormMessage className={cn(!isMobile && "col-span-2 col-start-2")} />
                                  </FormItem>
                              )}
                          />
                      </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                      <div className={cn('grid text-sm font-medium', gridLayout)}>
                        <Label>Article</Label>
                        {fromBC && <Label>Qté Cmdée</Label>}
                        <Label>Qté Reçue</Label>
                        <Label>Prix UHT</Label>
                        <Label>TVA (%)</Label>
                        <Label className="text-right">Total HT</Label>
                        {!fromBC && !readOnly && <div className="w-[50px]"></div>}
                      </div>
                    {fields.map((field, index) => {
                      const item = watchedItems[index];
                      const lineTotal = (item?.quantityReceived || 0) * (item?.price || 0);

                      return (
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
                                    <Input type="number" placeholder="Prix UHT" className="w-full" disabled={readOnly || fromBC} value={itemField.value ?? ''} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
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
                </form>
              </Form>
            </div>

            <div className="flex-shrink-0 p-6 pt-0">
              <DialogFooter className="sm:justify-end">
                <div className='flex gap-2'>
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    {readOnly ? 'Fermer' : 'Annuler'}
                  </Button>
                  {!readOnly && (
                    <Button type="submit" form="resizable-dialog-form">{isEditMode ? 'Enregistrer' : 'Créer le bon de réception'}</Button>
                  )}
                </div>
              </DialogFooter>
            </div>
        </div>

        <div 
            onMouseDown={startResizingX} 
            className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
        />
        <div 
            onMouseDown={startResizingY} 
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize" 
        />
        <div 
            onMouseDown={startResizing}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        />

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
