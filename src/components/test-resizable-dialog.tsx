import React, { useState, useEffect, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight, X, Minus, PlusCircle, Search, Check, Building2, User, Phone, Mail, Plus, AlertTriangle, Merge, Loader2, Eraser } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

// --- FIREBASE IMPORTS ---
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore"
import { useFirestore } from "@/hooks/use-firestore" 
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates" 
import type { PurchaseReceipt, PurchaseReceiptItem } from "@/lib/types" 
import { useToast } from "@/hooks/use-toast" 

import { ArticleDialog } from "@/components/article-dialog"
import { RepresentativeDialog } from "@/components/representative-dialog"
import { SupplierDialog } from "@/components/supplier-dialog"

// --- TYPES ---
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

// --- HELPER: SAFE ID GENERATOR ---
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- HELPER: DEDUPLICATE LISTS ---
const deduplicate = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

// --- SUB-COMPONENTS (Searchers) ---
// (Keeping these mostly the same, just standardizing props)
const SimpleSearchList = ({ items, onSelect, onCreateNew, placeholder }: any) => {
    const [term, setTerm] = useState("")
    const filtered = items.filter((i:any) => i.name.toLowerCase().includes(term.toLowerCase()) || i.code?.toLowerCase().includes(term.toLowerCase()));
    return (
        <div className="flex flex-col h-full max-h-[300px]">
            <div className="p-2 border-b"><Input placeholder={placeholder} value={term} onChange={e => setTerm(e.target.value)} autoFocus /></div>
            <div onClick={onCreateNew} className="flex items-center gap-2 p-2 text-sm text-blue-600 bg-blue-50 cursor-pointer hover:bg-blue-100"><PlusCircle className="h-4 w-4"/> Nouveau</div>
            <div className="flex-1 overflow-auto">
                {filtered.map((item:any) => (
                    <div key={item.id} className="p-2 border-b cursor-pointer hover:bg-slate-50 text-sm" onClick={() => onSelect(item)}>
                        <span className="font-mono text-xs text-slate-500 mr-2">{item.code}</span> {item.name}
                    </div>
                ))}
            </div>
        </div>
    )
}

const SimpleSearchDialog = ({ isOpen, onOpenChange, items, placeholder, onSelect, onCreateNew }: any) => {
  const [term, setTerm] = useState("");
  const filteredItems = useMemo(() => {
    if (!term) return items;
    return items.filter((item:any) => 
      item.name.toLowerCase().includes(term.toLowerCase()) || 
      (item.code && item.code.toLowerCase().includes(term.toLowerCase()))
    );
  }, [term, items]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0">
        <div className="p-4 border-b">
          <Input placeholder={placeholder} value={term} onChange={e => setTerm(e.target.value)} autoFocus />
        </div>
        <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b">
          <PlusCircle className="h-4 w-4"/> Nouveau
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filteredItems.map((item:any) => (
            <div key={item.id} className="p-3 border-b cursor-pointer hover:bg-slate-50" onClick={() => onSelect(item)}>
              {item.name}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};


const SelectorButton = ({ label, onClick, hasError }: any) => (
    <div className="flex gap-1 w-full">
        <div onClick={onClick} className={cn("flex-1 border rounded px-3 py-2 text-sm cursor-pointer truncate bg-white", hasError && "border-red-500 bg-red-50")}>
            {label}
        </div>
        <Button variant="ghost" size="icon" onClick={onClick}><Search className="h-4 w-4"/></Button>
    </div>
)

// --- MAIN COMPONENT ---
export function TestResizableDialog() {
  const [open, setOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  // DRAG STATE (Raw HTML Drag)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })

  const [dockOffset, setDockOffset] = useState(0) 
  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingReceipts, setExistingReceipts] = useState<PurchaseReceipt[]>([])
  
  // Data State
  const [receiptNumber, setReceiptNumber] = useState("BR-0001")
  const [remarks, setRemarks] = useState("") 
  const [formErrors, setFormErrors] = useState<any>({}) 
  const [isHoveringDock, setIsHoveringDock] = useState(false)
  const { toast } = useToast()
  const db = useFirestore()

  // Form Fields
  const [date, setDate] = useState<Date>(new Date())
  const [dueDate, setDueDate] = useState<Date>(new Date())
  const [supplierId, setSupplierId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [representativeId, setRepresentativeId] = useState("")
  const [reference, setReference] = useState("")
  const [items, setItems] = useState<InvoiceItem[]>([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }])
  
  // Lists
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [reps, setReps] = useState<Representative[]>([])

  // Search Dialog States
  const [searchType, setSearchType] = useState<"supplier" | "rep" | "article" | null>(null)
  const [targetRowId, setTargetRowId] = useState<string | null>(null) // For articles
  
  // Creation Dialog States
  const [createType, setCreateType] = useState<"supplier" | "rep" | "article" | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  // --- CALCULATIONS ---
  const { totalTTC } = items.reduce((acc, item) => {
      const ht = item.price * item.qty;
      return { totalTTC: acc.totalTTC + ht + (ht * (item.tva/100)) }
  }, { totalTTC: 0 })

  const calculateNextNumber = (list: PurchaseReceipt[]) => {
      if (!list.length) return "BR-0001";
      const max = list.reduce((m, r) => Math.max(m, parseInt(r.receiptNumber.replace("BR-", "")||"0", 10)), 0);
      return `BR-${(max + 1).toString().padStart(4, '0')}`;
  }

  // --- EFFECTS ---
  useEffect(() => {
    if(open && db) {
        const load = async () => {
            const [a, s, r, rec] = await Promise.all([
                getDocs(collection(db, "products")),
                getDocs(collection(db, "suppliers")),
                getDocs(collection(db, "representatives")),
                getDocs(collection(db, "purchaseReceipts"))
            ]);
            setArticles(deduplicate(a.docs.map(d=>({id:d.id, ...d.data()} as Article))));
            setSuppliers(deduplicate(s.docs.map(d=>({id:d.id, ...d.data()} as Supplier))));
            setReps(deduplicate(r.docs.map(d=>({id:d.id, ...d.data()} as Representative))));
            const recList = rec.docs.map(d=>({id:d.id, ...d.data()} as PurchaseReceipt));
            setExistingReceipts(recList);
            setReceiptNumber(calculateNextNumber(recList));
        }
        load();
    }
  }, [open, db]);

  useEffect(() => {
    const sidebar = document.querySelector('aside') || document.querySelector('.sidebar');
    if (sidebar) setDockOffset(sidebar.getBoundingClientRect().width);
  }, []);

  // --- DRAG LOGIC (Raw) ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (isMinimized) return;
      if(e.target !== e.currentTarget) return;
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      startPos.current = { ...position };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  }
  const onMouseMove = (e: MouseEvent) => {
      setPosition({
          x: startPos.current.x + (e.clientX - dragStart.current.x),
          y: startPos.current.y + (e.clientY - dragStart.current.y)
      })
  }
  const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
  }

  // --- HANDLERS ---
  const handleSave = async () => {
      if(!supplierId || !receiptNumber.trim() || !items.find(i=>i.articleId)) {
          setFormErrors({ supplier: !supplierId, receiptNumber: !receiptNumber.trim(), items: !items.find(i=>i.articleId) });
          return;
      }
      setIsSubmitting(true);
      try {
          await addDocumentNonBlocking(collection(db!, "purchaseReceipts"), {
              receiptNumber, supplierId, receiptDate: date.toISOString(),
              items: items.filter(i=>i.articleId).map(i=>({ productId: i.articleId, quantityReceived: i.qty, price: i.price, tvaRate: i.tva })),
              status: "Brouillon", totalTTC, paymentMode: paymentMethod, dueDate: dueDate.toISOString(),
              representativeId, reference, remarks
          });
          toast({ title: "Succès", description: "Bon créé" });
          setOpen(false);
          reset();
      } catch(e) { console.error(e); }
      setIsSubmitting(false);
  }

  const reset = () => {
      setReceiptNumber(calculateNextNumber(existingReceipts));
      setSupplierId(""); setRepresentativeId(""); setRemarks("");
      setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }]);
      setPosition({ x: 0, y: 0 });
      setFormErrors({});
  }

  // --- RENDER ---
  return (
    <>
      <Button variant="outline" onClick={() => { setPosition({x:0, y:0}); setOpen(true); setIsMinimized(false); }}>
        Open Dialog (Raw)
      </Button>

      {/* RAW BACKDROP & MODAL - NO SHADCN */}
      {open && (
        <div className="fixed inset-0 z-[50] pointer-events-none flex items-center justify-center font-sans">
            {/* BACKDROP */}
            {!isMinimized && <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setOpen(false)} />}

            {/* THE WINDOW */}
            <div 
                className={cn(
                    "absolute bg-white border border-slate-200 shadow-2xl pointer-events-auto flex flex-col",
                    isMinimized ? "rounded-t-lg" : "rounded-lg"
                )}
                style={{
                    // RAW CSS POSITIONING
                    width: isMinimized ? (isHoveringDock ? '600px' : '280px') : '900px',
                    height: isMinimized ? (isHoveringDock ? '500px' : 'auto') : '600px',
                    left: isMinimized ? `${dockOffset + 20}px` : `calc(50% + ${position.x}px)`,
                    top: isMinimized ? 'auto' : `calc(50% + ${position.y}px)`,
                    bottom: isMinimized ? '0px' : 'auto',
                    transform: isMinimized ? 'none' : 'translate(-50%, -50%)',
                    transition: isDragging ? 'none' : 'width 0.2s, height 0.2s, left 0.2s, top 0.2s'
                }}
                onMouseEnter={() => isMinimized && setIsHoveringDock(true)}
                onMouseLeave={() => setIsHoveringDock(false)}
             >
                {/* HEADER */}
                <div 
                    onMouseDown={handleMouseDown}
                    className={cn("bg-slate-100 p-4 border-b flex justify-between items-center cursor-move select-none", isMinimized && "py-2")}
                >
                    <span className="font-semibold text-sm">{isMinimized ? `Bon ${receiptNumber}` : "Nouveau Bon de Réception"}</span>
                    <div className="flex gap-2">
                        <Minus className="h-4 w-4 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)} />
                        <X className="h-4 w-4 cursor-pointer text-red-500" onClick={() => setOpen(false)} />
                    </div>
                </div>

                {/* CONTENT */}
                <div className={cn("flex-1 overflow-hidden bg-white flex flex-col", isMinimized && !isHoveringDock && "hidden")}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* FORM GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <div>
                                    <Label>Numéro *</Label>
                                    <Input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} className={formErrors.receiptNumber ? "border-red-500" : ""} />
                                </div>
                                <div>
                                    <Label>Fournisseur *</Label>
                                    <SelectorButton 
                                        label={suppliers.find(s=>s.id===supplierId)?.name || "Sélectionner..."} 
                                        onClick={() => setSearchType("supplier")}
                                        hasError={formErrors.supplier}
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <Label>Représentant</Label>
                                    <SelectorButton 
                                        label={reps.find(r=>r.id===representativeId)?.name || "Sélectionner..."} 
                                        onClick={() => setSearchType("rep")}
                                    />
                                </div>
                                <div>
                                    <Label>Remarque</Label>
                                    <Input value={remarks} onChange={e => setRemarks(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className="border rounded">
                            <div className="bg-slate-50 p-2 text-xs font-semibold grid grid-cols-[1fr_80px_80px_40px] gap-2">
                                <span>Article</span><span>Qté</span><span>Prix</span><span></span>
                            </div>
                            {items.map((item, idx) => {
                                const art = articles.find(a => a.id === item.articleId);
                                return (
                                    <div key={item.id} className="p-2 border-b grid grid-cols-[1fr_80px_80px_40px] gap-2 items-center">
                                        <div 
                                            className={cn("border rounded px-2 py-1 text-sm truncate cursor-pointer h-9 content-center", !art && "text-slate-400")}
                                            onClick={() => { setTargetRowId(item.id); setSearchType("article"); }}
                                        >
                                            {art ? art.name : "Choisir..."}
                                        </div>
                                        <Input type="number" className="h-9" value={item.qty} onChange={e => {
                                            const v = parseInt(e.target.value)||1;
                                            setItems(prev => prev.map(l => l.id===item.id ? {...l, qty:v} : l))
                                        }} />
                                        <Input type="number" className="h-9" value={item.price} onChange={e => {
                                             const v = parseFloat(e.target.value)||0;
                                             setItems(prev => prev.map(l => l.id===item.id ? {...l, price:v} : l))
                                        }} />
                                        <Button variant="ghost" size="icon" onClick={() => setItems(items.filter(i=>i.id!==item.id))}><Trash2 className="h-4 w-4 text-red-500"/></Button>
                                    </div>
                                )
                            })}
                             <Button variant="ghost" className="w-full h-8 text-xs" onClick={() => setItems([...items, {id:generateId(), articleId:"", qty:1, price:0, tva:20}])}>+ Ajouter ligne</Button>
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="p-3 border-t bg-slate-50 flex justify-between items-center">
                        <div className="font-bold">Total TTC: {totalTTC.toFixed(2)} €</div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                            <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? "..." : "Créer"}</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* SEARCH POPUPS (Simplest Possible Implementation using Popover logic but manual) */}
      <SimpleSearchDialog 
        isOpen={searchType === "supplier"}
        onOpenChange={() => setSearchType(null)}
        items={suppliers}
        placeholder="Chercher fournisseur..."
        onSelect={(s:any) => { setSupplierId(s.id); setSearchType(null); }}
        onCreateNew={() => { setSearchType(null); setCreateType("supplier"); }}
      />
      <SimpleSearchDialog 
        isOpen={searchType === "rep"}
        onOpenChange={() => setSearchType(null)}
        items={reps}
        placeholder="Chercher représentant..."
        onSelect={(r:any) => { setRepresentativeId(r.id); setSearchType(null); }}
        onCreateNew={() => { setSearchType(null); setCreateType("rep"); }}
      />
      <SimpleSearchDialog 
        isOpen={searchType === "article"}
        onOpenChange={() => setSearchType(null)}
        items={articles}
        placeholder="Chercher article..."
        onSelect={(a:any) => {
          if (targetRowId) {
            setItems(prev => prev.map(i => i.id === targetRowId ? { ...i, articleId: a.id, price: a.price, tva: a.tva || 20 } : i));
          }
          setSearchType(null);
        }}
        onCreateNew={() => { setSearchType(null); setPendingRowId(targetRowId); setCreateType("article"); }}
      />

      {/* CREATION DIALOGS */}
      <ArticleDialog 
        isOpen={createType === "article"} 
        onOpenChange={(v:boolean) => !v && setCreateType(null)} 
        onArticleCreated={(a:any) => {
            setArticles(prev => [a, ...prev]);
            if(pendingRowId) setItems(prev => prev.map(i => i.id === pendingRowId ? {...i, articleId: a.id, price: a.price, tva: a.tva||20} : i));
            setCreateType(null);
        }}
        articles={articles} isChild={true}
      />
      <RepresentativeDialog 
        isOpen={createType === "rep"} 
        onOpenChange={(v:boolean) => !v && setCreateType(null)} 
        onRepresentativeCreated={(r:any) => { setReps(prev => [r, ...prev]); setRepresentativeId(r.id); setCreateType(null); }}
        representatives={reps} 
      />
       <SupplierDialog 
        isOpen={createType === "supplier"} 
        onOpenChange={(v:boolean) => !v && setCreateType(null)} 
        onSupplierCreated={(s:any) => { setSuppliers(prev => [s, ...prev]); setSupplierId(s.id); setCreateType(null); }}
        suppliers={suppliers} 
      />
    </>
  )
}
