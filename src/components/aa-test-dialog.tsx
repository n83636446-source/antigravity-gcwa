import React, { useState, useEffect, useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogTitle, DialogPortal } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Minus, PlusCircle, Merge, Loader2, AlertTriangle, X } from "lucide-react"
import { isSameDay, isBefore, startOfDay } from "date-fns"
import { cn, roundMoney, generateId, isDuplicateNumber } from "@/lib/utils"

 
 
import { api } from "@/lib/api"
import { productFromApi, supplierFromApi, representativeFromApi, purchaseCreditNoteFromApi, purchaseCreditNoteToApi } from "@/lib/types";
import type { PurchaseCreditNote, PurchaseInvoice } from "@/lib/types" 
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

interface AaTestDialogProps {
    creditNoteToEdit?: PurchaseCreditNote | null;
    invoiceToTransfer?: PurchaseInvoice | null;
    isTransferInstance?: boolean;
    onSaveSuccess?: () => void;
}

export function AaTestDialog({ creditNoteToEdit, invoiceToTransfer, isTransferInstance = false, onSaveSuccess }: AaTestDialogProps) {
  const storageKeyPrefix = isTransferInstance ? 'aaTransferDialog' : 'aaTestDialog';

  const [open, setOpen] = useState<boolean>((() => {
    if (isTransferInstance) return !!invoiceToTransfer;
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`${storageKeyPrefix}State`);
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  })());

  useEffect(() => {
    if (isTransferInstance) return;
    sessionStorage.setItem(`${storageKeyPrefix}State`, JSON.stringify(open));
  }, [open, storageKeyPrefix]);

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (isTransferInstance) return false;
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`${storageKeyPrefix}MinimizedState`);
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    if (isTransferInstance) return;
    sessionStorage.setItem(`${storageKeyPrefix}MinimizedState`, JSON.stringify(isMinimized));
  }, [isMinimized, storageKeyPrefix]);
  
  const { state, isMobile } = useSidebar();
  const dockOffset = isMobile ? 0 : (state === 'expanded' ? 256 : 48);
  const dialogRef = useRef<HTMLDivElement>(null)
  
  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const { shakeTick, overlayShakeTick, triggerFieldShake, triggerOverlayShake } = useShakeWarning();
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingCreditNotes, setExistingCreditNotes] = useState<PurchaseCreditNote[]>([])
  
  const [creditNoteNumber, setCreditNoteNumber] = useState("AA0001")
  const [remarks, setRemarks] = useState("") 
  const [formErrors, setFormErrors] = useState<{
      supplier?: boolean;
      items?: boolean;
      creditNoteNumber?: boolean;
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

  const [isHoveringDock, setIsHoveringDock] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isEditMode = !!creditNoteToEdit;
  const isValidated = creditNoteToEdit?.status === 'Validé';

  const calculateNextNumber = (creditNotes: PurchaseCreditNote[]) => {
    if (!creditNotes || creditNotes.length === 0) return "AA0001";
    const maxId = creditNotes.reduce((max, r) => {
        const codeDigits = r.creditNoteNumber.replace("AA", "").trim();
        const numVal = parseInt(codeDigits, 10);
        return isNaN(numVal) ? max : (numVal > max ? numVal : max);
    }, 0);
    return `AA${(maxId + 1).toString().padStart(4, '0')}`;
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
    setShowCloseAlert(false); 
    setFormErrors({}); 
    setCreditNoteNumber(calculateNextNumber(existingCreditNotes));
    setIsHoveringDock(false);
  }

  const isFormDirty = () => {
      if (isValidated) return false;
      if (creditNoteNumber !== (isEditMode ? creditNoteToEdit?.creditNoteNumber : calculateNextNumber(existingCreditNotes))) return true;
      if (!isSameDay(date, isEditMode ? new Date(creditNoteToEdit!.creditNoteDate) : new Date())) return true;
      if (supplierId !== (isEditMode ? creditNoteToEdit?.supplierId : "")) return true;
      if (remarks !== (isEditMode ? (creditNoteToEdit?.remarks || "") : "")) return true;
      if (reference !== (isEditMode ? (creditNoteToEdit?.reference || "") : "")) return true;
      if (representativeId !== (isEditMode ? (representativeId === "" ? "" : creditNoteToEdit?.representativeId) : "")) return true;
      if (paymentMethod !== (isEditMode ? (creditNoteToEdit?.paymentMode || "cash") : "cash")) return true;
      if (isEditMode && creditNoteToEdit?.dueDate && !isSameDay(dueDate, new Date(creditNoteToEdit.dueDate))) return true;

      const currentItemsNormalized = items.map(i => ({ articleId: i.articleId, qty: i.qty, price: i.price, tva: i.tva }));
      const originalItemsNormalized = isEditMode && creditNoteToEdit
          ? creditNoteToEdit.items.map(i => ({ articleId: i.productId, qty: i.quantity, price: i.price, tva: i.tvaRate }))
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

  useEffect(() => {
    const fetchData = async () => {
      
      try {
        const [articlesSnap, suppliersSnap, repsSnap, creditNotesSnap] = await Promise.all([
            api.getProducts(),
            api.getSuppliers(),
            api.getRepresentatives(),
            api.getPurchaseCreditNotes()
        ])

        const articles = articlesSnap.map(productFromApi);
        const suppliers = suppliersSnap.map(supplierFromApi);
        const reps = repsSnap.map(representativeFromApi);
        const creditNotes = creditNotesSnap.map(purchaseCreditNoteFromApi);

        setAvailableArticles(deduplicate(articles));
        setAvailableSuppliers(deduplicate(suppliers));
        setAvailableRepresentatives(deduplicate(reps));
        setExistingCreditNotes(creditNotes);

        if (isEditMode && creditNoteToEdit) {
            setCreditNoteNumber(creditNoteToEdit.creditNoteNumber);
            setDate(new Date(creditNoteToEdit.creditNoteDate));
            setSupplierId(creditNoteToEdit.supplierId);
            setPaymentMethod(creditNoteToEdit.paymentMode || "cash");
            if (creditNoteToEdit.dueDate) setDueDate(new Date(creditNoteToEdit.dueDate));
            setRepresentativeId(creditNoteToEdit.representativeId || "");
            setReference(creditNoteToEdit.reference || "");
            setRemarks(creditNoteToEdit.remarks || "");
            setItems(creditNoteToEdit.items.map(item => ({
              id: generateId(),
              articleId: item.productId,
              qty: item.quantity,
              price: item.price,
              tva: item.tvaRate
            })));
            setOpen(true);
        } else if (invoiceToTransfer) {
            setCreditNoteNumber(calculateNextNumber(creditNotes));
            setDate(new Date());
            setSupplierId(invoiceToTransfer.supplierId);
            setPaymentMethod(invoiceToTransfer.paymentMode || "cash");
            if (invoiceToTransfer.dueDate) setDueDate(new Date(invoiceToTransfer.dueDate));
            setRepresentativeId(invoiceToTransfer.representativeId || "");
            setReference(invoiceToTransfer.reference || "");
            setRemarks(invoiceToTransfer.remarks || "");
            setItems(invoiceToTransfer.items.map(item => ({
              id: generateId(),
              articleId: item.productId,
              qty: item.quantity,
              price: item.price,
              tva: item.tvaRate
            })));
            setOpen(true);
        } else {
            setCreditNoteNumber(calculateNextNumber(creditNotes));
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }
    if (open) fetchData()
  }, [open, isEditMode, creditNoteToEdit, invoiceToTransfer])

  useEffect(() => {
    if (isBefore(dueDate, startOfDay(date))) {
      setDueDate(date);
    }
  }, [date]);

  const handleCreateCreditNote = async () => {
    if (isValidated) return;
    const newErrors: typeof formErrors = {};
    let hasError = false;

    const isDuplicate = isDuplicateNumber(existingCreditNotes, 'creditNoteNumber', creditNoteNumber, creditNoteToEdit?.id);
    if (isDuplicate) {
        newErrors.creditNoteNumber = true;
        hasError = true;
    }

    if (!supplierId) { newErrors.supplier = true; hasError = true; }
    if (!creditNoteNumber.trim()) { newErrors.creditNoteNumber = true; hasError = true; }
    const validItems = items.filter(i => i.articleId && i.qty > 0);
    if (validItems.length === 0) { newErrors.items = true; hasError = true; }
    
    if (isBefore(dueDate, startOfDay(date))) {
        newErrors.dueDate = true;
        hasError = true;
    }

    if (hasError) {
        setFormErrors(newErrors);
        triggerFieldShake();
        return;
    }
    setFormErrors({});
    setIsSubmitting(true);
    try {
        const creditNoteData: any = {
            creditNoteNumber: creditNoteNumber, 
            supplierId: supplierId,
            creditNoteDate: date instanceof Date ? date.toISOString() : new Date().toISOString(),
            items: validItems.map(i => ({
                productId: i.articleId,
                quantity: i.qty,
                price: i.price,
                tvaRate: i.tva
            })),
            status: isEditMode ? creditNoteToEdit!.status : "Brouillon", 
            totalHT: totalHT,
            totalTTC: totalTTC,
            paymentMode: paymentMethod,
            dueDate: dueDate instanceof Date ? dueDate.toISOString() : new Date().toISOString(),
        };
        if (representativeId) creditNoteData.representativeId = representativeId;
        if (reference) creditNoteData.reference = reference;
        if (remarks) creditNoteData.remarks = remarks;
        if (invoiceToTransfer) creditNoteData.purchaseInvoiceId = invoiceToTransfer.id;

        if (isEditMode && creditNoteToEdit) {
            await api.updatePurchaseCreditNote(creditNoteToEdit.id, purchaseCreditNoteToApi(creditNoteData));
            toast({ title: "Succès", description: `Avoir ${creditNoteNumber} mis à jour avec succès.` });
            onSaveSuccess?.();
            setOpen(false);
            setTimeout(() => { resetForm(); setIsSubmitting(false); }, 300);
        } else {
            creditNoteData.id = "aa-" + Date.now();
            const docRef = await api.createPurchaseCreditNote(purchaseCreditNoteToApi(creditNoteData));
            if (docRef) {
                toast({ title: "Succès", description: `Avoir ${creditNoteNumber} créé avec succès.` });
            onSaveSuccess?.();
                setOpen(false);
                setTimeout(() => { resetForm(); setIsSubmitting(false); }, 300);
            }
        }
    } catch (error) {
        console.error("Failed to save credit note", error);
        toast({ title: "Erreur", description: error instanceof Error && error.message ? error.message : "Une erreur est survenue lors de l'enregistrement.", variant: "destructive" });
        setIsSubmitting(false);
    }
  }

  const addItem = () => {
    if (isValidated) return;
    const id = generateId()
    const newItem = { id, articleId: "", qty: 1, price: 0, tva: 20 }
    setItems([...items, newItem])
    setNewRowId(id) 
  }

  const insertItemAfter = (currentId: string) => {
    if (isValidated) return;
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
    if (isValidated) return;
    setItems(items.filter(item => item.id !== id))
  }

  const handleLineChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    if (isValidated) return;
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
    if (isValidated) return;
    setItems(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, price: roundMoney(item.price) }
        }
        return item
    }))
  }

  const handleMerge = (originalId: string, duplicateId: string) => {
    if (isValidated) return;
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
    if (isValidated) return;
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



  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (isFormDirty()) {
        if (isMinimized) setIsMinimized(false)
        setShowCloseAlert(true)
        return 
      }
      setOpen(false)
      setTimeout(() => {
        resetForm() 
        setIsMinimized(false)
      }, 300)
    } else {
      setOpen(true)
    }
  }

  const confirmClose = () => {
      setShowCloseAlert(false)
      setOpen(false)
      setTimeout(() => { resetForm(); setIsMinimized(false); }, 300)
  }

  const handleOverlayClick = () => {
      triggerOverlayShake()
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
    if (isMinimized) { setIsHoveringDock(false); }
  }

  const handleMouseEnter = () => {
    if (!isMinimized) return;
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
    setIsHoveringDock(true);
  };

  const handleMouseLeave = () => {
    if (!isMinimized) return;
    hoverTimeoutRef.current = setTimeout(() => { setIsHoveringDock(false); }, 250);
  };

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
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.creditNoteNumber && "text-red-500")}>Numéro *</Label>
                          <div key={shakeTick} className={cn("w-full min-0", formErrors.creditNoteNumber && "animate-shake")}>
                            <Input value={creditNoteNumber} onChange={(e) => setCreditNoteNumber(e.target.value)} disabled={isValidated} className={cn("w-full min-w-0 font-mono", formErrors.creditNoteNumber && "border-red-500 focus-visible:ring-red-500")} />
                            {formErrors.creditNoteNumber && (
                                <span className="text-xs text-red-500 mt-1 block">
                                    {creditNoteNumber.trim() ? "Ce numéro de document est déjà utilisé." : "Le numéro est obligatoire."}
                                </span>
                            )}
                          </div>
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Date de la pièce</Label>
                          <DatePickerField selected={date} onSelect={setDate} placeholder="JJ/MM/AAAA" disabled={isValidated} />
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                     <div className="space-y-4 pt-2">
                        <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                           <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.supplier && "text-red-500")}>Fournisseur *</Label>
                           <div key={shakeTick} className={cn("w-full", formErrors.supplier && "animate-shake")}>
                               <SupplierSelector value={supplierId} onChange={handleSupplierChange} suppliers={availableSuppliers} disabled={isValidated} onOpenAdvanced={() => setIsSupplierSearchOpen(true)} onCreateNew={() => setIsCreateSupplierOpen(true)} hasError={formErrors.supplier} />
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
                          <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isValidated}>
                              <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                  <SelectValue placeholder="Espèces" />
                              </SelectTrigger>
                              <SelectContent><SelectItem value="cash">Espèces</SelectItem></SelectContent>
                           </Select>
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.dueDate && "text-red-500")}>Date d'échéance</Label>
                          <div key={shakeTick} className={cn("w-full", formErrors.dueDate && "animate-shake")}>
                              <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="JJ/MM/AAAA" disabled={isValidated} minDate={date} />
                              {formErrors.dueDate && <span className="text-xs text-red-500 mt-1 block">La date d'échéance ne peut pas être antérieure à la date de pièce.</span>}
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                    <div className="space-y-4 pt-2">
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Représentant</Label>
                          <RepresentativeSelector value={representativeId} onChange={handleRepresentativeChange} representatives={availableRepresentatives} disabled={isValidated} onOpenAdvanced={() => setIsRepresentativeSearchOpen(true)} onCreateNew={() => setIsCreateRepOpen(true)} />
                        </div>
                       <div className="space-y-4 pt-2">
                          <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                             <Label className={isMobileSize ? "text-left" : "text-right"}>Référence</Label>
                             <Input placeholder="Référence" disabled={isValidated} className="w-full min-w-0" value={reference} onChange={(e) => setReference(e.target.value)} />
                          </div>
                          <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                             <Label className={isMobileSize ? "text-left" : "text-right"}>Remarque</Label>
                             <Input placeholder="Remarque" disabled={isValidated} className="w-full min-w-0" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
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
                              <ArticleSelector value={item.articleId} onChange={(val: string) => handleArticleChange(item.id, val)} articles={availableArticles} disabled={isValidated} onOpenAdvanced={() => openArticleSearch(item.id)} onCreateNew={() => handleCreateNewArticle(item.id)} autoFocus={item.id === newRowId} />
                              {!isValidated && originalItem && (
                                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mt-2 animate-in fade-in slide-in-from-top-1">
                                     <AlertTriangle className="h-3 w-3 shrink-0" />
                                     <span className="font-medium">Article déjà présent.</span>
                                     <Button size="sm" variant="outline" className="h-6 text-xs bg-white hover:bg-amber-100 border-amber-300 text-amber-800 ml-auto" onClick={() => handleMerge(originalItem.id, item.id)}><Merge className="mr-1 h-3 w-3" />Fusionner</Button>
                                  </div>
                              )}
                            </td>
                            <td className="p-4 align-middle"><Input type="number" value={item.qty} min={1} disabled={isValidated} onChange={(e) => handleLineChange(item.id, 'qty', Number(e.target.value))} className="min-w-[80px]" /></td>
                            <td className="p-4 align-middle"><Input type="number" value={item.price} min={0} disabled={isValidated} onChange={(e) => handleLineChange(item.id, 'price', Number(e.target.value))} onBlur={() => handlePriceBlur(item.id)} className="min-w-[80px] bg-slate-50" /></td>
                            <td className="p-4 align-middle"><Input type="number" value={item.tva} readOnly disabled={isValidated} className="min-w-[80px] bg-slate-50" /></td>
                            <td className="p-4 align-middle text-right font-medium">{(item.price * item.qty).toFixed(2)} €</td>
                            <td className="p-4 align-middle flex items-center justify-end gap-1">
                               {!isValidated && (
                                 <>
                                   <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => insertItemAfter(item.id)} title="Insérer"><PlusCircle className="h-4 w-4" /></Button>
                                   <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                                 </>
                               )}
                            </td>
                          </tr>
                      )
                  })}
                  {!isValidated && (
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
      <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg text-right">
        <div className="space-y-2 mb-4">
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>{totalHT.toFixed(2)} €</span></div>
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>{totalTVA.toFixed(2)} €</span></div>
            <div className="flex justify-end gap-4 font-bold text-lg text-blue-900"><span>TOTAL TTC:</span> <span>{totalTTC.toFixed(2)} €</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{isValidated ? "Fermer" : "Annuler"}</Button>
          {!isValidated && (
            <Button className="bg-slate-900 text-white" disabled={isSubmitting} onClick={handleCreateCreditNote}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : (isEditMode ? "Enregistrer" : "Créer")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
        <DialogPortal>
          <div 
            className="fixed inset-0 z-40 flex pointer-events-none transition-all duration-300 ease-in-out"
          >
             {!isMobile && (
                <div 
                    className="flex-none transition-all duration-300 ease-in-out" 
                    style={{ width: dockOffset }} 
                />
             )}

             <div className="flex-1 relative pointer-events-none h-full w-full">
                {open && !isMinimized && (
                    <div 
                        className="absolute inset-0 z-40 bg-black/80 pointer-events-auto transition-all duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                        onClick={(e) => { e.stopPropagation(); handleOverlayClick(); }}
                    />
                )}

                <DialogPrimitive.Content 
                    onInteractOutside={(e) => {
                        e.preventDefault(); 
                        if (!isMinimized && showCloseAlert) {
                            handleOverlayClick();
                        }
                    }}
                    className={cn(
                        "p-0 overflow-visible bg-transparent border-none shadow-none max-w-none w-auto h-auto transition-all duration-300 ease-in-out [&>button]:!hidden pointer-events-none outline-none focus:outline-none",
                        isMinimized 
                        ? "absolute bottom-[10px] left-4 z-[9999] w-fit max-w-fit translate-x-0 translate-y-0"
                        : "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-auto"
                    )}
                    style={
                        isMinimized 
                        ? { transition: "all 0.3s ease-in-out" } 
                        : { 
                            width: "96%", 
                            height: "96%",
                            transition: "all 0.3s ease-in-out"
                            }
                    }
                >
                    <div 
                        ref={dialogRef}
                        onClick={isMinimized ? toggleMinimize : undefined}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            "relative bg-white border rounded shadow-xl flex flex-col pointer-events-auto",
                            isMinimized ? "shadow-md cursor-pointer overflow-visible px-0 h-10" : "rounded-lg h-full",
                            "transition-all duration-300 ease-in-out"
                        )}
                        style={{ 
                            width: "100%",
                            height: isMinimized ? 40 : "100%",
                            transformOrigin: isMinimized ? "bottom left" : "center", 
                            transition: "all 0.3s ease-in-out" 
                        }}
                    >
                        {showCloseAlert && (
                            <div 
                            className="absolute inset-0 z-[10000] flex items-center justify-center rounded-lg p-4 bg-black/5"
                            onClick={handleOverlayClick}
                            >
                            <div 
                                key={overlayShakeTick}
                                className="bg-white border shadow-lg p-6 rounded-md max-w-sm text-center animate-shake"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="font-semibold text-lg mb-2">Attention</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                  Voulez-vous enregistrer les modifications appliquées à l'avoir d'achat {creditNoteNumber} ?
                                </p>
                                <div className="flex justify-center gap-2">
                                    <Button className="bg-slate-900 text-white min-w-[70px]" size="sm" onClick={() => { setShowCloseAlert(false); handleCreateCreditNote(); }}>Oui</Button>
                                    <Button variant="destructive" size="sm" className="min-w-[70px]" onClick={confirmClose}>Non</Button>
                                    <Button variant="outline" size="sm" className="min-w-[70px]" onClick={() => setShowCloseAlert(false)}>Annuler</Button>
                                </div>
                            </div>
                            </div>
                        )}

                        {isMinimized && (
                            <div className={cn("absolute bottom-full left-1/2 -translate-x-1/2 pb-3 z-[10000] origin-bottom transition-all duration-300 ease-out", isHoveringDock ? "scale-100 opacity-100 pointer-events-auto" : "scale-0 opacity-0 pointer-events-none")}>
                            <div className="group bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden cursor-pointer relative" style={{ width: 1000 * 0.25, height: 800 * 0.25 }} onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}>
                                <button onClick={(e) => { e.stopPropagation(); handleOpenChange(false); setIsHoveringDock(false); }} className="absolute top-2 right-2 z-50 p-1.5 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 rounded-md transition-opacity duration-200 shadow-sm pointer-events-auto opacity-0 group-hover:opacity-100" title="Fermer"><X className="h-4 w-4" /></button>
                                <div className="pointer-events-none origin-top-left bg-white flex flex-col" style={{ width: 1000, height: 800, transform: 'scale(0.25)' }}>
                                    <div className="flex-none p-4 flex items-center gap-2 font-semibold text-sm">{isEditMode ? "Modifier" : "Créer"} un avoir d'achat</div>
                                    <div className="px-6 pb-4 border-b text-muted-foreground text-sm">Remplissez les informations ci-dessous.</div>
                                    <div className="flex-1 min-h-0 flex flex-col">{formAndFooterJSX}</div>
                                </div>
                            </div>
                            </div>
                        )}

                        <div className="absolute right-3 top-3 z-50 flex gap-1">
                            {!isMinimized && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} onMouseDown={(e) => e.stopPropagation()} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Réduire"><Minus className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleOpenChange(false)} onMouseDown={(e) => e.stopPropagation()} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-colors cursor-pointer" title="Fermer"><X className="h-4 w-4" /></button>
                            </>
                            )}
                        </div>

                        <div className={cn("flex-none p-4 select-none flex items-center gap-2", !isMinimized && "cursor-default", isMinimized && "py-0 px-3 h-10")}>
                            {isMinimized && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                            <div className={cn("font-semibold text-sm", isMinimized ? "whitespace-nowrap pr-2" : "truncate pr-12")}>{isMinimized ? `Avoir d'achat - ${creditNoteNumber}` : `${isEditMode ? "Modifier l'" : "Créer un "}avoir d'achat${isEditMode ? ` - ${creditNoteNumber}` : ""}`}</div>
                        </div>
                        {!isMinimized && (<div className="px-6 pb-4 border-b text-muted-foreground text-sm text-left">Remplissez les informations ci-dessous.</div>)}
                        <div className={cn("flex-col flex-1 min-h-0 transition-opacity duration-300", isMinimized ? "hidden" : "flex")}>
                            <DialogTitle className="sr-only">{isEditMode ? "Modifier" : "Créer"} un avoir d'achat</DialogTitle>
                            {formAndFooterJSX}
                        </div>
                    </div>
                </DialogPrimitive.Content>
             </div>
          </div>
        </DialogPortal>
      </Dialog>

      <ArticleDialog isOpen={isCreateArticleOpen} onOpenChange={setIsCreateArticleOpen} onArticleCreated={handleArticleCreated} articles={availableArticles} isChild={true} />
      <RepresentativeDialog isOpen={isCreateRepOpen} onOpenChange={setIsCreateRepOpen} onRepresentativeCreated={handleRepresentativeCreated} representatives={availableRepresentatives} />
      <SupplierDialog isOpen={isCreateSupplierOpen} onOpenChange={setIsCreateSupplierOpen} onSupplierCreated={handleSupplierCreated} suppliers={availableSuppliers} />
      <SupplierSearchDialog isOpen={isSupplierSearchOpen} onOpenChange={setIsSupplierSearchOpen} onSelect={handleSupplierSearchSelect} suppliers={availableSuppliers} onCreateNew={() => { setIsSupplierSearchOpen(false); setIsCreateSupplierOpen(true); }} />
      <RepresentativeSearchDialog isOpen={isRepresentativeSearchOpen} onOpenChange={setIsRepresentativeSearchOpen} onSelect={handleRepresentativeSearchSelect} representatives={availableRepresentatives} onCreateNew={() => { setIsRepresentativeSearchOpen(false); setIsCreateRepOpen(true); }} />
      <ArticleSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} onSelect={handleArticleSearchSelect} articles={availableArticles} onCreateNew={() => { setIsSearchOpen(false); if(searchTargetRowId) handleCreateNewArticle(searchTargetRowId); }} />
    </>
  )
}






