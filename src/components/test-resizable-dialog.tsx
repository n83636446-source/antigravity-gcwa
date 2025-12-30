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
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, PurchaseOrder, PurchaseReceipt, Supplier, Representative } from '@/lib/types';
import { Separator } from './ui/separator';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  receiptDate: z.date({ required_error: 'La date est requise.' }),
  items: z.array(receiptItemSchema).min(1, 'Le bon de réception doit contenir au moins un article.'),
  paymentMode: z.string().optional(),
  dueDate: z.date({ required_error: "La date d'échéance est requise." }),
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
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!receipt;
  
  const [isArticleDialogOpen, setArticleDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const articleCreationIndex = useRef<number | null>(null);
  
  const suppliersRef = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersRef);

  const productsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
  const { data: allProducts } = useCollection<Product>(productsRef);

  const representativesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'representatives') : null), [firestore]);
  const { data: representatives } = useCollection<Representative>(representativesRef);


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
      receiptNumber: '',
      purchaseOrderId: '',
      supplierId: '',
      receiptDate: new Date(),
      items: [],
      paymentMode: 'Espèces',
      dueDate: new Date(),
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
    if (!open) {
      form.reset({
        receiptNumber: '',
        purchaseOrderId: '',
        supplierId: '',
        receiptDate: new Date(),
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
        receiptDate: new Date(receipt.receiptDate),
        items: receipt.items.map(item => ({
          productId: item.productId,
          quantityOrdered: orderForReceipt?.items.find(i => i.productId === item.productId)?.quantity || 0,
          quantityReceived: item.quantityReceived,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
        paymentMode: receipt.paymentMode,
        dueDate: receipt.dueDate ? new Date(receipt.dueDate) : new Date(),
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
        receiptDate: new Date(),
        items: purchaseOrder.items.map(item => ({
          productId: item.productId,
          quantityOrdered: item.quantity,
          quantityReceived: item.quantity,
          price: item.price,
          tvaRate: item.tvaRate,
        })),
        paymentMode: purchaseOrder.paymentMode,
        dueDate: purchaseOrder.dueDate ? new Date(purchaseOrder.dueDate) : new Date(),
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
            receiptDate: new Date(),
            items: [{ productId: '', quantityOrdered: 0, quantityReceived: 0, price: 0, tvaRate: 20 }],
            paymentMode: 'Espèces',
            dueDate: new Date(),
            representativeId: '',
            reference: '',
            remarks: '',
         });
      }
    }
  }, [open, isEditMode, receipt, purchaseOrder, watchedOrderId, purchaseOrders, form, replace, lastReceiptNumber]);


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

    const receiptData = {
        receiptNumber: data.receiptNumber,
        purchaseOrderId: data.purchaseOrderId,
        supplierId: data.supplierId,
        receiptDate: data.receiptDate.toISOString(),
        items: data.items.map(({ productId, quantityReceived, price, tvaRate }) => ({
            productId,
            quantityReceived,
            price: price ?? 0,
            tvaRate: tvaRate ?? 20,
        })),
        totalHT,
        totalTTC,
        paymentMode: data.paymentMode,
        dueDate: data.dueDate.toISOString(),
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
  
  const readOnly = isEditMode && receipt?.status === 'Validé';
  
  const [size, setSize] = useState({ width: 1000, height: 800 });
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const handleMouseDown = (direction: 'right' | 'bottom' | 'corner') => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(direction);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      setSize(prev => {
          const newWidth = isDragging === 'right' || isDragging === 'corner' ? Math.max(350, prev.width + e.movementX) : prev.width;
          const newHeight = isDragging === 'bottom' || isDragging === 'corner' ? Math.max(400, prev.height + e.movementY) : prev.height;
          return { width: newWidth, height: newHeight };
      });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
      setIsDragging(null);
  }, []);

  useEffect(() => {
      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      } else {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const isMobile = size.width < 900;

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Test Dialog</Button>
      </DialogTrigger>
      
      <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] p-0 overflow-hidden bg-transparent border-none shadow-none sm:max-w-[none] w-auto h-auto">
        <div 
          className="relative bg-white border rounded-lg shadow-xl flex flex-col"
          style={{ width: size.width, height: size.height }}
        >
          <div className="flex-none p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>Créer un bon de réception</DialogTitle>
              <DialogDescription>Remplissez les informations ci-dessous.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-6 pt-10 min-h-0">
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-12")}>
                  <div className={cn("border border-blue-800 p-4 rounded-md relative min-w-0", isMobile ? "col-span-1" : "col-span-4")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Informations pièce</h3>
                    <div className="space-y-4 pt-2">
                        <FormField
                            control={form.control}
                            name="receiptNumber"
                            render={({ field }) => (
                                <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                    <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Numéro</Label>
                                    <Input {...field} className="w-full min-w-0" />
                                </div>
                             )}
                        />
                         <FormField
                            control={form.control}
                            name="receiptDate"
                            render={({ field }) => (
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Date de la pièce</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full flex items-center justify-between px-3 text-left font-normal overflow-hidden", !field.value && "text-muted-foreground")}
                                        >
                                            <span className="truncate flex-1 min-w-0">
                                              {field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                                            </span>
                                            <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                               </div>
                            )}
                        />
                    </div>
                  </div>
                  <div className={cn("border border-blue-800 p-4 rounded-md relative min-w-0", isMobile ? "col-span-1" : "col-span-8")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                    <div className="pt-2">
                         <FormField
                            control={form.control}
                            name="supplierId"
                            render={({ field }) => (
                                <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                    <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Fournisseur</Label>
                                    <Select onValueChange={handleSupplierChange} value={field.value}>
                                        <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                            <SelectValue placeholder="Sélectionnez un fournisseur" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                    </div>
                  </div>
                    <div className={cn("border border-blue-800 p-4 rounded-md relative min-w-0", isMobile ? "col-span-1" : "col-span-4")}>
                        <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Règlement</h3>
                        <div className="space-y-4 pt-2">
                            <FormField
                                control={form.control}
                                name="paymentMode"
                                render={({ field }) => (
                                     <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                        <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Mode de paiement</Label>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                                <SelectValue placeholder="Mode de paiement" />
                                            </SelectTrigger>
                                             <SelectContent>
                                                <SelectItem value="Espèces">Espèces</SelectItem>
                                                <SelectItem value="Chèque">Chèque</SelectItem>
                                                <SelectItem value="Virement">Virement</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                        <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Date d'échéance</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                 <Button
                                                    variant={"outline"}
                                                    className={cn("w-full flex items-center justify-between px-3 text-left font-normal overflow-hidden", !field.value && "text-muted-foreground")}
                                                  >
                                                    <span className="truncate flex-1 min-w-0">
                                                      {field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                                                    </span>
                                                    <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                  </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                    <div className={cn("border border-blue-800 p-4 rounded-md relative min-w-0", isMobile ? "col-span-1" : "col-span-8")}>
                        <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                        <div className="space-y-4 pt-2">
                             <FormField
                                control={form.control}
                                name="representativeId"
                                render={({ field }) => (
                                    <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                        <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Représentant</Label>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                                <SelectValue placeholder="Sélectionnez un représentant" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(representatives || []).map(rep => (
                                                    <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="reference"
                                render={({ field }) => (
                                    <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 items-stretch gap-2" : "grid-cols-[110px_1fr]")}>
                                        <Label className={cn("min-w-0", isMobile ? "text-left" : "text-right")}>Référence</Label>
                                        <Input {...field} placeholder="Référence" className="w-full min-w-0" />
                                    </div>
                                )}
                            />
                        </div>
                    </div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="w-[40%] min-w-[200px]">Article</TableHead>
                      <TableHead className="w-[15%] min-w-[80px]">Qté</TableHead>
                      <TableHead className="w-[15%] min-w-[80px]">Prix UHT</TableHead>
                      <TableHead className="w-[15%] min-w-[80px]">TVA (%)</TableHead>
                      <TableHead className="w-[15%] text-right min-w-[80px]">Total HT</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Select defaultValue="article1">
                            <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                <SelectValue placeholder="Sélectionnez un article"/>
                            </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="article1">Robe d'été à fleurs (Exemple)</SelectItem>
                            <SelectItem value="article2">Pantalon Lin Beige</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" defaultValue="1" className="min-w-0 w-full" /></TableCell>
                      <TableCell><Input type="number" defaultValue="45.00" className="min-w-0 w-full" /></TableCell>
                      <TableCell><Input type="number" defaultValue="20" className="min-w-0 w-full" /></TableCell>
                      <TableCell className="text-right font-medium">45,00 €</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6}>
                         <Button variant="outline" className="w-full border-dashed text-muted-foreground">+ Ajouter une ligne</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

            </form>
           </Form>
          </div>
          <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg">
            <div className="space-y-2 text-right mb-4">
                <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>0,00 €</span></div>
                <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>0,00 €</span></div>
                <div className="flex justify-end gap-4 font-bold text-lg"><span>Total TTC:</span> <span>0,00 €</span></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" form='receipt-form' className="bg-slate-900 text-white">Créer</Button>
            </DialogFooter>
          </div>
          <div onMouseDown={handleMouseDown('right')} className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-50 hover:bg-blue-400/50 transition-colors" />
          <div onMouseDown={handleMouseDown('bottom')} className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize z-50 hover:bg-blue-400/50 transition-colors" />
          <div onMouseDown={handleMouseDown('corner')} className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize z-50 bg-slate-200/50 hover:bg-blue-400 rounded-tl-md" />
        </div>
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
