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
  
  const [size, setSize] = useState({ width: 1000, height: 800 });
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const handleMouseDown = (direction: 'right' | 'bottom' | 'corner') => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(direction);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging) return;

      setSize(prev => {
          let newWidth = prev.width;
          let newHeight = prev.height;

          if (isDragging === 'right' || isDragging === 'corner') {
              newWidth = Math.max(350, e.clientX - e.movementX);
          }
          if (isDragging === 'bottom' || isDragging === 'corner') {
              newHeight = Math.max(400, e.clientY - e.movementY);
          }
          
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Test Dialog</Button>
      </DialogTrigger>
      {/* 1. OUTER FRAME: No scrolling, just a rigid container */}
      <DialogContent className="p-0 overflow-hidden sm:max-w-[none] border-none bg-transparent shadow-none" style={{ maxWidth: '100vw', maxHeight: '100vh' }}>
        
        {/* 2. RESIZABLE WRAPPER: Controlled by state size */}
        <div 
          className="relative bg-white border rounded-lg shadow-xl flex flex-col"
          style={{ width: size.width, height: size.height }}
        >
          
          {/* --- HEADER (Fixed) --- */}
          <div className="flex-none p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>Créer un bon de réception</DialogTitle>
              <DialogDescription>
                Créez un bon de réception à partir d'un bon de commande existant ou manuellement.
              </DialogDescription>
            </DialogHeader>
          </div>
      {/* --- BODY (Scrollable) --- */}
      {/* pt-10 ensures the 'Information pièce' title isn't cut off */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pt-10">
        <form className="space-y-8">
          {/* YOUR GRID CONTENT HERE */}
          {/* Use the existing grid code you have, but ensure the 'isMobile' logic is applied */}
          <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-12")}>
             {/* ... (Keep your Zone 1, 2, 3, 4 code exactly as it was) ... */}
             {/* Just make sure Zone 1 starts here so we see if it is clipped */}
          </div>
          {/* ITEMS TABLE WRAPPER */}
          <div className="w-full overflow-x-auto border rounded-md">
            {/* ... Table code ... */}
          </div>
        </form>
      </div>
      {/* --- FOOTER (Fixed) --- */}
      <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg">
        <div className="space-y-2 text-right mb-4">
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>0,00 €</span></div>
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>0,00 €</span></div>
            <div className="flex justify-end gap-4 font-bold text-lg"><span>Total TTC:</span> <span>0,00 €</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-slate-900 text-white">Créer le bon de réception</Button>
        </DialogFooter>
      </div>
      {/* --- RESIZE HANDLES (Overlay) --- */}
      {/* Right Handle */}
      <div 
        onMouseDown={handleMouseDown('right')}
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-50 hover:bg-blue-400/20 transition-colors"
      />
      {/* Bottom Handle */}
      <div 
        onMouseDown={handleMouseDown('bottom')}
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize z-50 hover:bg-blue-400/20 transition-colors"
      />
      {/* Corner Handle */}
      <div 
        onMouseDown={handleMouseDown('corner')}
        className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize z-50 bg-slate-200/50 hover:bg-blue-400 rounded-tl-md"
      />
    </div>
  </DialogContent>
</Dialog>
  );
}
