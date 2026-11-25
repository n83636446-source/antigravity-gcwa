import React, { useState, useEffect } from "react"
import { DocumentDialogShell, useDocumentDialogShell } from "@/components/document-dialog-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, PlusCircle, Merge, Loader2, AlertTriangle } from "lucide-react"
import { isSameDay, isBefore, startOfDay } from "date-fns"
import { cn, roundMoney, generateId, isDuplicateNumber } from "@/lib/utils"

 
 
import { api } from "@/lib/api"
import { productFromApi, supplierFromApi, representativeFromApi, purchaseInvoiceFromApi, purchaseInvoiceToApi } from "@/lib/types";
import type { PurchaseInvoice, PurchaseReceipt } from "@/lib/types" 
import { useToast } from "@/hooks/use-toast" 

import { ArticleDialog } from "@/components/article-dialog"
import { RepresentativeDialog } from "@/components/representative-dialog"
import { SupplierDialog } from "@/components/supplier-dialog"
import { useSidebar } from "@/components/ui/sidebar"
import { useShakeWarning } from "@/hooks/use-shake-warning"

// --- SHARED UI IMPORTS ---
import {
  RepresentativeSelector,
  SupplierSelector,
  ArticleSelector,
  RepresentativeSearchDialog,
  SupplierSearchDialog,
  ArticleSearchDialog,
  DatePickerField,
  FieldMessage,
} from "@/components/purchase-dialog-shared-ui"

// --- TYPES LOCAUX ---
type Article = {
  id: string
  code: string
  name: string
  description?: string
  price: number
  stockLevel?: number
  reorderThreshold?: number
  familyId?: string
  tva?: number 
}

type Supplier = {
  id: string
  code: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  street?: string
  city?: string
  country?: string
  ice?: string
}

type Representative = {
  id: string
  code?: string 
  name: string
  email?: string
}

type InvoiceItem = {
  id: string
  articleId: string
  qty: number
  price: number
  tva: number
}

// --- HELPER: DEDUPLICATE LISTS ---
const deduplicate = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

interface FaaDialogProps {
    invoiceToEdit?: PurchaseInvoice | null;
    receiptToTransfer?: PurchaseReceipt | null;
    isTransferInstance?: boolean;
    onSaveSuccess?: () => void;
}

export function FaaDialog({ invoiceToEdit, receiptToTransfer, isTransferInstance = false, onSaveSuccess }: FaaDialogProps) {
  const shell = useDocumentDialogShell({
    storageKeyPrefix: 'faa',
    isDirty: () => isFormDirty(),
    onReset: () => resetForm(),
    persistState: !isTransferInstance,
    initialOpen: !!receiptToTransfer,
  })
  const { open, setOpen, handleOpenChange } = shell
  const { isMobile } = useSidebar();
  const { shakeTick, triggerFieldShake } = useShakeWarning();
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingInvoices, setExistingInvoices] = useState<PurchaseInvoice[]>([])
  
  const [invoiceNumber, setInvoiceNumber] = useState("FA0001")
  const [remarks, setRemarks] = useState("") 
  const [formErrors, setFormErrors] = useState<{
      supplier?: boolean;
      items?: boolean;
      invoiceNumber?: boolean;
      dueDate?: boolean;
  }>({}) 

  const { toast } = useToast()

  const [date, setDate] = useState<Date>(new Date())
  const [dueDate, setDueDate] = useState<Date>(new Date())
  const [supplierId, setSupplierId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [representativeId, setRepresentativeId] = useState<string>("")
  const [reference, setReference] = useState<string>("")
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }
  ])
  const [availableArticles, setAvailableArticles] = useState<Article[]>([])
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([])
  const [availableRepresentatives, setAvailableRepresentatives] = useState<Representative[]>([])

  const [newRowId, setNewRowId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false) 
  const [isRepresentativeSearchOpen, setIsRepresentativeSearchOpen] = useState(false) 
  const [searchTargetRowId, setSearchTargetRowId] = useState<string | null>(null)

  

  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false)
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false)
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  const isEditMode = !!invoiceToEdit;
  const isLocked = !!(invoiceToEdit && invoiceToEdit.status !== 'Brouillon');

  const calculateNextNumber = (invoices: PurchaseInvoice[]) => {
    if (!invoices || invoices.length === 0) return "FA0001";
    const maxId = invoices.reduce((max, r) => {
        const codeDigits = r.invoiceNumber.replace("FA", "").trim();
        const numVal = parseInt(codeDigits, 10);
        return isNaN(numVal) ? max : (numVal > max ? numVal : max);
    }, 0);
    return `FA${(maxId + 1).toString().padStart(4, '0')}`;
  };

  const resetForm = () => {
    setDate(new Date())
    setDueDate(new Date())
    setSupplierId("")
    setPaymentMethod("cash")
    setRepresentativeId("")
    setReference("")
    setRemarks("")
    setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }]); 
    setFormErrors({}); 
    setInvoiceNumber(calculateNextNumber(existingInvoices));
  }

  const isFormDirty = () => {
      if (isLocked) return false;
      if (invoiceNumber !== (isEditMode ? invoiceToEdit?.invoiceNumber : calculateNextNumber(existingInvoices))) return true;
      if (!isSameDay(date, isEditMode ? new Date(invoiceToEdit!.invoiceDate) : new Date())) return true;
      if (supplierId !== (isEditMode ? invoiceToEdit?.supplierId : "")) return true;
      if (remarks !== (isEditMode ? (invoiceToEdit?.remarks || "") : "")) return true;
      if (reference !== (isEditMode ? (invoiceToEdit?.reference || "") : "")) return true;
      if (representativeId !== (isEditMode ? (invoiceToEdit?.representativeId || "") : "")) return true;
      if (paymentMethod !== (isEditMode ? (invoiceToEdit?.paymentMode || "cash") : "cash")) return true;
      if (isEditMode && invoiceToEdit?.dueDate && !isSameDay(dueDate, new Date(invoiceToEdit.dueDate))) return true;

      const currentItemsNormalized = items.map(i => ({ articleId: i.articleId, qty: i.qty, price: i.price, tva: i.tva }));
      const originalItemsNormalized = isEditMode && invoiceToEdit
          ? invoiceToEdit.items.map(i => ({ articleId: i.productId, qty: i.quantity, price: i.price, tva: i.tvaRate }))
          : [{ articleId: "", qty: 1, price: 0, tva: 20 }];
      if (JSON.stringify(currentItemsNormalized) !== JSON.stringify(originalItemsNormalized)) return true;

      return false;
  }

  const { totalHT, totalTVA, totalTTC } = items.reduce(
    (acc, item) => {
      const lineHT = roundMoney(item.price * item.qty);
      const lineTVA = roundMoney(lineHT * (item.tva / 100));
      return {
        totalHT: roundMoney(acc.totalHT + lineHT),
        totalTVA: roundMoney(acc.totalTVA + lineTVA),
        totalTTC: roundMoney(acc.totalTTC + lineHT + lineTVA),
      };
    },
    { totalHT: 0, totalTVA: 0, totalTTC: 0 }
  );

  const advanceTotal = invoiceToEdit?.advanceTotal ?? 0;
  const amountPaid = invoiceToEdit?.amountPaid ?? 0;
  const balanceDue = roundMoney(totalTTC - advanceTotal - amountPaid);

  useEffect(() => {
    const fetchData = async () => {
      
      try {
        const [articlesSnap, suppliersSnap, repsSnap, invoicesSnap] = await Promise.all([
            api.getProducts(),
            api.getSuppliers(),
            api.getRepresentatives(),
            api.getPurchaseInvoices()
        ])

        const articles = articlesSnap.map(productFromApi);
        const suppliers = suppliersSnap.map(supplierFromApi);
        const reps = repsSnap.map(representativeFromApi);
        const invoices = invoicesSnap.map(purchaseInvoiceFromApi);

        setAvailableArticles(deduplicate(articles));
        setAvailableSuppliers(deduplicate(suppliers));
        setAvailableRepresentatives(deduplicate(reps));
        setExistingInvoices(invoices);

        if (isEditMode && invoiceToEdit) {
            setInvoiceNumber(invoiceToEdit.invoiceNumber);
            setDate(new Date(invoiceToEdit.invoiceDate));
            setSupplierId(invoiceToEdit.supplierId);
            setPaymentMethod(invoiceToEdit.paymentMode || "cash");
            if (invoiceToEdit.dueDate) setDueDate(new Date(invoiceToEdit.dueDate));
            setRepresentativeId(invoiceToEdit.representativeId || "");
            setReference(invoiceToEdit.reference || "");
            setRemarks(invoiceToEdit.remarks || "");
            setItems(invoiceToEdit.items.map(item => ({
              id: generateId(),
              articleId: item.productId,
              qty: item.quantity,
              price: item.price,
              tva: item.tvaRate
            })));
            setOpen(true);
        } else if (receiptToTransfer) {
            setInvoiceNumber(calculateNextNumber(invoices));
            setDate(new Date());
            setSupplierId(receiptToTransfer.supplierId);
            setPaymentMethod(receiptToTransfer.paymentMode || "cash");
            if (receiptToTransfer.dueDate) setDueDate(new Date(receiptToTransfer.dueDate));
            setRepresentativeId(receiptToTransfer.representativeId || "");
            setReference(receiptToTransfer.reference || "");
            setRemarks(receiptToTransfer.remarks || "");
            setItems(receiptToTransfer.items.map(item => ({
              id: generateId(),
              articleId: item.productId,
              qty: item.quantityReceived,
              price: item.price,
              tva: item.tvaRate
            })));
            setOpen(true);
        } else {
            setInvoiceNumber(calculateNextNumber(invoices));
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }
    if (open) fetchData()
  }, [open, setOpen, isEditMode, invoiceToEdit, receiptToTransfer])

  useEffect(() => {
    if (isBefore(dueDate, startOfDay(date))) {
      setDueDate(date);
    }
  }, [date]);

  const handleCreateInvoice = async () => {
    if (isLocked) return;
    const newErrors: typeof formErrors = {};
    let hasError = false;

    const isDuplicate = isDuplicateNumber(existingInvoices, 'invoiceNumber', invoiceNumber, invoiceToEdit?.id);
    if (isDuplicate) {
        newErrors.invoiceNumber = true;
        hasError = true;
    }

    if (!supplierId) { newErrors.supplier = true; hasError = true; }
    if (!invoiceNumber.trim()) { newErrors.invoiceNumber = true; hasError = true; }
    const validItems = items.filter(i => i.articleId && i.qty > 0);
    if (validItems.length === 0) { newErrors.items = true; hasError = true; }
    
    if (isBefore(dueDate, startOfDay(date))) {
        newErrors.dueDate = true;
        hasError = true;
    }

    if (isEditMode && totalTTC < advanceTotal) {
        toast({ title: "Erreur", description: "Le total de la facture ne peut pas être inférieur aux acomptes déjà saisis.", variant: "destructive" });
        triggerFieldShake();
        return;
    }

    if (hasError) {
        setFormErrors(newErrors);
        triggerFieldShake();
        return;
    }
    setFormErrors({});
    setIsSubmitting(true);
    try {
        const invoiceData: any = {
            invoiceNumber: invoiceNumber, 
            supplierId: supplierId,
            invoiceDate: date instanceof Date ? date.toISOString() : new Date().toISOString(),
            items: validItems.map(i => ({
                productId: i.articleId,
                quantity: i.qty,
                price: i.price,
                tvaRate: i.tva
            })),
            status: isEditMode ? invoiceToEdit!.status : "Brouillon", 
            totalHT: totalHT,
            totalTTC: totalTTC,
            paymentMode: paymentMethod,
            dueDate: dueDate instanceof Date ? dueDate.toISOString() : new Date().toISOString(),
        };
        if (representativeId) invoiceData.representativeId = representativeId;
        if (reference) invoiceData.reference = reference;
        if (remarks) invoiceData.remarks = remarks;
        if (receiptToTransfer) invoiceData.purchaseReceiptId = receiptToTransfer.id;

        if (isEditMode && invoiceToEdit) {
            await api.updatePurchaseInvoice(invoiceToEdit.id, purchaseInvoiceToApi(invoiceData));
            toast({ title: "Succès", description: `Facture d'achat ${invoiceNumber} mise à jour avec succès.` });
            onSaveSuccess?.();
            setOpen(false);
            setTimeout(() => { resetForm(); setIsSubmitting(false); }, 300);
        } else {
            invoiceData.id = "fa-" + Date.now();
            const docRef = await api.createPurchaseInvoice(purchaseInvoiceToApi(invoiceData));
            if (docRef) {
                toast({ title: "Succès", description: `Facture d'achat ${invoiceNumber} créée avec succès.` });
            onSaveSuccess?.();
                setOpen(false);
                setTimeout(() => { resetForm(); setIsSubmitting(false); }, 300);
            }
        }
    } catch (error) {
        console.error("Failed to save invoice", error);
        toast({ title: "Erreur", description: error instanceof Error && error.message ? error.message : "Une erreur est survenue lors de l'enregistrement.", variant: "destructive" });
        setIsSubmitting(false);
    }
  }

  const addItem = () => {
    if (isLocked) return;
    const id = generateId()
    const newItem = { id, articleId: "", qty: 1, price: 0, tva: 20 }
    setItems([...items, newItem])
    setNewRowId(id) 
  }

  const insertItemAfter = (currentId: string) => {
    if (isLocked) return;
    const newId = generateId()
    const newItem = { id: newId, articleId: "", qty: 1, price: 0, tva: 20 }
    setItems(prevItems => {
        const index = prevItems.findIndex(item => item.id === currentId)
        if (index === -1) return prevItems
        const newItems = [...prevItems]
        newItems.splice(index + 1, 0, newItem)
        return newItems
    })
    setNewRowId(newId) 
  }

  const removeItem = (id: string) => {
    if (isLocked) return;
    setItems(items.filter(item => item.id !== id))
  }

  const handleLineChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    if (isLocked) return;
    let finalValue = value;
    if (field === 'qty') {
        const num = Number(value);
        if (num < 1) finalValue = 1;
        else finalValue = num;
    }
    if (field === 'price') {
        const num = Number(value);
        if (num < 0) finalValue = 0;
        else finalValue = num;
    }
    setItems(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, [field]: finalValue }
        }
        return item
    }))
  }

  const handlePriceBlur = (id: string) => {
    if (isLocked) return;
    setItems(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, price: roundMoney(item.price) }
        }
        return item
    }))
  }

  const handleMerge = (originalId: string, duplicateId: string) => {
    if (isLocked) return;
    const duplicateItem = items.find(i => i.id === duplicateId);
    if (!duplicateItem) return;
    setItems(prev => {
        const updatedItems = prev.map(item => {
            if (item.id === originalId) {
                return { ...item, qty: item.qty + duplicateItem.qty };
            }
            return item;
        });
        return updatedItems.filter(item => item.id !== duplicateId);
    });
    setFlashingRowId(originalId);
    setTimeout(() => setFlashingRowId(null), 1000);
  }

  const handleArticleChange = (rowId: string, value: string) => {
    if (isLocked) return;
    const selectedArticle = availableArticles.find(a => a.id === value)
    if (selectedArticle) {
        setItems(items.map(item => 
            item.id === rowId 
                ? { ...item, articleId: value, price: selectedArticle.price, tva: selectedArticle.tva || 20 } 
                : item
        ))
    }
  }

  const handleCreateNewArticle = (rowId: string) => {
      setPendingRowId(rowId)
      setIsCreateArticleOpen(true)
  }

  const openArticleSearch = (rowId: string) => {
      setSearchTargetRowId(rowId)
      setIsSearchOpen(true)
  }

  const handleArticleSearchSelect = (article: Article) => {
      if (searchTargetRowId) {
          handleArticleChange(searchTargetRowId, article.id)
      }
      setIsSearchOpen(false)
      setSearchTargetRowId(null)
  }

  const handleArticleCreated = (newArticle: any) => {
     const articleWithType = newArticle as Article;
     setAvailableArticles(prev => deduplicate([articleWithType, ...prev]));
     if (pendingRowId) {
        setItems(items.map(item => 
            item.id === pendingRowId 
                ? { ...item, articleId: articleWithType.id, price: articleWithType.price, tva: articleWithType.tva || 20 } 
                : item
        ))
     }
     setPendingRowId(null);
  }

  const handleRepresentativeChange = (value: string) => {
      if (value === "create_new_rep") { setIsCreateRepOpen(true); return; }
      setRepresentativeId(value)
  }

  const handleRepresentativeSearchSelect = (rep: Representative) => {
      setRepresentativeId(rep.id); setIsRepresentativeSearchOpen(false);
  }

  const handleRepresentativeCreated = (newRep: any) => {
      const repWithType = newRep as Representative
      setAvailableRepresentatives(prev => deduplicate([repWithType, ...prev]))
      setRepresentativeId(repWithType.id)
  }

  const handleSupplierChange = (value: string) => {
      if (value === "create_new_supplier") { setIsCreateSupplierOpen(true); return; }
      setSupplierId(value)
  }

  const handleSupplierSearchSelect = (supplier: Supplier) => {
      setSupplierId(supplier.id); setIsSupplierSearchOpen(false);
  }

  const handleSupplierCreated = (newSupplier: any) => {
      const supplierWithType = newSupplier as Supplier
      setAvailableSuppliers(prev => deduplicate([supplierWithType, ...prev]))
      setSupplierId(supplierWithType.id)
  }



  const isMobileSize = isMobile;

  const formAndFooterJSX = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-6 pt-6 text-left">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-6">
             <div className={cn("flex w-full gap-6", isMobileSize && "flex-col")}>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[40%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Informations pièce</h3>
                    <div className="space-y-4 pt-2">
                       <div className={cn("grid items-center", isMobileSize ? "grid-cols-1 gap-y-1" : "grid-cols-[110px_1fr] gap-x-4 gap-y-1")}>
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.invoiceNumber && "text-red-500")}>Numéro *</Label>
                          <div key={shakeTick} className={cn("w-full min-0", formErrors.invoiceNumber && "animate-shake")}>
                            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={isLocked} className={cn("w-full min-w-0 font-mono", formErrors.invoiceNumber && "border-red-500 focus-visible:ring-red-500")} />
                          </div>
                          <FieldMessage isMobile={isMobileSize}>{formErrors.invoiceNumber ? (invoiceNumber.trim() ? "Ce numéro de document est déjà utilisé." : "Le numéro est obligatoire.") : null}</FieldMessage>
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Date de facture</Label>
                          <DatePickerField selected={date} onSelect={setDate} placeholder="JJ/MM/AAAA" disabled={isLocked} />
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                     <div className="space-y-4 pt-2">
                        <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                           <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.supplier && "text-red-500")}>Fournisseur *</Label>
                           <div key={shakeTick} className={cn("w-full", formErrors.supplier && "animate-shake")}>
                               <SupplierSelector value={supplierId} onChange={handleSupplierChange} suppliers={availableSuppliers} disabled={isLocked} onOpenAdvanced={() => setIsSupplierSearchOpen(true)} onCreateNew={() => setIsCreateSupplierOpen(true)} hasError={formErrors.supplier} />
                               {formErrors.supplier && <span className="text-xs text-red-500 mt-1 block">Le fournisseur est obligatoire.</span>}
                           </div>
                        </div>
                     </div>
                 </div>
             </div>
             <div className={cn("flex w-full gap-6", isMobileSize && "flex-col")}>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[40%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Règlement</h3>
                    <div className="space-y-4 pt-2">
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Mode de paiement</Label>
                          <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isLocked}>
                              <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                  <SelectValue placeholder="Espèces" />
                              </SelectTrigger>
                              <SelectContent><SelectItem value="cash">Espèces</SelectItem></SelectContent>
                           </Select>
                       </div>
                       <div className={cn("grid items-center", isMobileSize ? "grid-cols-1 gap-y-1" : "grid-cols-[110px_1fr] gap-x-4 gap-y-1")}>
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.dueDate && "text-red-500")}>Date d'échéance</Label>
                          <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="JJ/MM/AAAA" disabled={isLocked} minDate={date} warningInOwnRow isMobile={isMobileSize} />
                          {formErrors.dueDate && (<FieldMessage isMobile={isMobileSize}>La date d'échéance ne peut pas être antérieure à la date de facture.</FieldMessage>)}
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                    <div className="space-y-4 pt-2">
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Représentant</Label>
                          <RepresentativeSelector value={representativeId} onChange={handleRepresentativeChange} representatives={availableRepresentatives} disabled={isLocked} onOpenAdvanced={() => setIsRepresentativeSearchOpen(true)} onCreateNew={() => setIsCreateRepOpen(true)} />
                        </div>
                       <div className="space-y-4 pt-2">
                          <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                             <Label className={isMobileSize ? "text-left" : "text-right"}>Référence</Label>
                             <Input placeholder="Référence" disabled={isLocked} className="w-full min-w-0" value={reference} onChange={(e) => setReference(e.target.value)} />
                          </div>
                          <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                             <Label className={isMobileSize ? "text-left" : "text-right"}>Remarque</Label>
                             <Input placeholder="Remarque" disabled={isLocked} className="w-full min-w-0" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                          </div>
                       </div>
                    </div>
                 </div>
             </div>
          </div>
          <div key={shakeTick} className={cn(formErrors.items && "animate-shake")}>
            <div className={cn("border border-blue-800 rounded-md min-h-[400px] overflow-visible mb-20", formErrors.items && "border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,1)]")}>
              {formErrors.items && <div className="bg-red-50 text-red-600 text-xs px-4 py-2 border-b border-red-100 font-medium">Veuillez ajouter au moins un article valide.</div>}
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-slate-50 [&_tr]:border-b">
                  <tr className="border-b border-blue-800 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[40%] min-w-[200px] rounded-tl-md">Article</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[15%] min-w-[80px]">Qté</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[15%] min-w-[80px]">Prix UHT</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[15%] min-w-[80px]">TVA (%)</th>
                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[15%] text-right min-w-[80px]">Total HT</th>
                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[90px] rounded-tr-md"></th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {items.map((item, index) => {
                      const originalItem = item.articleId ? items.find((i, iIndex) => i.articleId === item.articleId && iIndex < index) : null;
                      return (
                          <tr key={item.id} className={cn("border-b transition-all duration-1000 ease-out", flashingRowId === item.id ? "bg-green-100/80" : "hover:bg-muted/50 data-[state=selected]:bg-muted")}>
                            <td className="p-4 align-middle">
                              <ArticleSelector value={item.articleId} onChange={(val: string) => handleArticleChange(item.id, val)} articles={availableArticles} disabled={isLocked} onOpenAdvanced={() => openArticleSearch(item.id)} onCreateNew={() => handleCreateNewArticle(item.id)} autoFocus={item.id === newRowId} />
                              {!isLocked && originalItem && (
                                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mt-2 animate-in fade-in slide-in-from-top-1">
                                     <AlertTriangle className="h-3 w-3 shrink-0" />
                                     <span className="font-medium">Article déjà présent.</span>
                                     <Button size="sm" variant="outline" className="h-6 text-xs bg-white hover:bg-amber-100 border-amber-300 text-amber-800 ml-auto" onClick={() => handleMerge(originalItem.id, item.id)}><Merge className="mr-1 h-3 w-3" />Fusionner</Button>
                                  </div>
                              )}
                            </td>
                            <td className="p-4 align-middle"><Input type="number" value={item.qty} min={1} disabled={isLocked} onChange={(e) => handleLineChange(item.id, 'qty', Number(e.target.value))} className="min-w-[60px]" /></td>
                            <td className="p-4 align-middle"><Input type="number" value={item.price} min={0} disabled={isLocked} onChange={(e) => handleLineChange(item.id, 'price', Number(e.target.value))} onBlur={() => handlePriceBlur(item.id)} className="min-w-[60px] bg-slate-50" /></td>
                            <td className="p-4 align-middle"><Input type="number" value={item.tva} readOnly disabled={isLocked} className="min-w-[60px] bg-slate-50" /></td>
                            <td className="p-4 align-middle text-right font-medium">{(item.price * item.qty).toFixed(2)} €</td>
                            <td className="p-4 align-middle flex items-center justify-end gap-1">
                               {!isLocked && (
                                 <>
                                   <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => insertItemAfter(item.id)} title="Insérer"><PlusCircle className="h-4 w-4" /></Button>
                                   <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                                 </>
                               )}
                            </td>
                          </tr>
                      )
                  })}
                  {!isLocked && (
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td colSpan={6} className="p-4 align-middle">
                         <Button type="button" variant="outline" className="w-full border-dashed text-muted-foreground" onClick={addItem}>+ Ajouter une ligne</Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </div>
      <div className="flex-none p-6 pt-4 border-t bg-gray-50 text-right">
        <div className="space-y-2 mb-4">
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>{totalHT.toFixed(2)} €</span></div>
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>{totalTVA.toFixed(2)} €</span></div>
            <div className="flex justify-end gap-4 font-bold text-lg text-blue-900"><span>TOTAL TTC:</span> <span>{totalTTC.toFixed(2)} €</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{isLocked ? "Fermer" : "Annuler"}</Button>
          {!isLocked && (
            <Button className="bg-slate-900 text-white" disabled={isSubmitting} onClick={handleCreateInvoice}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : (isEditMode ? "Enregistrer" : "Créer")}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-none h-10 px-6 border-t bg-gray-100 rounded-b-lg flex items-center gap-x-8 text-sm text-left">
        {isEditMode && (
          <>
            <div className="flex gap-2"><span className="text-muted-foreground">Acompte:</span> <span>− {advanceTotal.toFixed(2)} €</span></div>
            <div className="flex gap-2"><span className="text-muted-foreground">Déjà réglé:</span> <span>− {amountPaid.toFixed(2)} €</span></div>
            <div className={cn("flex gap-2 font-semibold", balanceDue < 0 && "text-red-600")}><span>SOLDE DÛ:</span> <span>{balanceDue.toFixed(2)} €</span></div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <DocumentDialogShell
        shell={shell}
        title={`${isEditMode ? "Modifier la" : "Créer une"} facture d'achat${isEditMode ? ` - ${invoiceNumber}` : ""}`}
        minimizedTitle={`Facture d'achat - ${invoiceNumber}`}
        previewTitle={`${isEditMode ? "Modifier" : "Créer"} une facture d'achat`}
        srTitle={`${isEditMode ? "Modifier" : "Créer"} une facture d'achat`}
        subtitle="Remplissez les informations ci-dessous."
        closeAlertMessage={`Voulez-vous enregistrer les modifications appliquées à la facture d'achat ${invoiceNumber} ?`}
        onSaveFromAlert={handleCreateInvoice}
      >
        {formAndFooterJSX}
      </DocumentDialogShell>

      <ArticleDialog isOpen={isCreateArticleOpen} onOpenChange={setIsCreateArticleOpen} onArticleCreated={handleArticleCreated} articles={availableArticles} isChild={true} />
      <RepresentativeDialog isOpen={isCreateRepOpen} onOpenChange={setIsCreateRepOpen} onRepresentativeCreated={handleRepresentativeCreated} representatives={availableRepresentatives} />
      <SupplierDialog isOpen={isCreateSupplierOpen} onOpenChange={setIsCreateSupplierOpen} onSupplierCreated={handleSupplierCreated} suppliers={availableSuppliers} />
      <SupplierSearchDialog isOpen={isSupplierSearchOpen} onOpenChange={setIsSupplierSearchOpen} onSelect={handleSupplierSearchSelect} suppliers={availableSuppliers} onCreateNew={() => { setIsSupplierSearchOpen(false); setIsCreateSupplierOpen(true); }} />
      <RepresentativeSearchDialog isOpen={isRepresentativeSearchOpen} onOpenChange={setIsRepresentativeSearchOpen} onSelect={handleRepresentativeSearchSelect} representatives={availableRepresentatives} onCreateNew={() => { setIsRepresentativeSearchOpen(false); setIsCreateRepOpen(true); }} />
      <ArticleSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} onSelect={handleArticleSearchSelect} articles={availableArticles} onCreateNew={() => { setIsSearchOpen(false); if(searchTargetRowId) handleCreateNewArticle(searchTargetRowId); }} />
    </>
  )
}
