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
type Article = { id: string; code: string; name: string; description?: string; price: number; stockLevel?: number; reorderThreshold?: number; familyId?: string; tva?: number }
type Supplier = { id: string; code: string; name: string; contactName?: string; contactEmail?: string; contactPhone?: string; street?: string; city?: string; country?: string; ice?: string }
type Representative = { id: string; code?: string; name: string; email?: string }
type InvoiceItem = { id: string; articleId: string; qty: number; price: number; tva: number }

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const deduplicate = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set();
  return items.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
};

// --- SUB-COMPONENTS (Defined at top to avoid ReferenceError) ---

const RepresentativeSearchDialog = ({ isOpen, onOpenChange, onSelect, representatives, onCreateNew }: any) => {
  const [term, setTerm] = useState("")
  const filtered = useMemo(() => {
    if (!term) return representatives;
    return representatives.filter((r:any) => r.name.toLowerCase().includes(term.toLowerCase()));
  }, [term, representatives]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <div className="p-4 border-b">
             <Input placeholder="Rechercher..." value={term} onChange={e => setTerm(e.target.value)} autoFocus />
        </div>
        <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 cursor-pointer border-b">
            <PlusCircle className="h-4 w-4" /> Nouveau Représentant
        </div>
        <div className="flex-1 overflow-auto p-0 max-h-[400px]">
            {filtered.map((rep: any) => (
                <div key={rep.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(rep)}>
                    {rep.name}
                </div>
            ))}
        </div>
        <div className="p-2 border-t flex justify-end"><Button variant="outline" onClick={()=>onOpenChange(false)}>Fermer</Button></div>
      </DialogContent>
    </Dialog>
  )
}

const SupplierSearchDialog = ({ isOpen, onOpenChange, onSelect, suppliers, onCreateNew }: any) => {
    const [term, setTerm] = useState("")
    const filtered = useMemo(() => {
        if (!term) return suppliers;
        return suppliers.filter((s:any) => s.name.toLowerCase().includes(term.toLowerCase()));
    }, [term, suppliers]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
            <DialogTitle className="sr-only">Rechercher</DialogTitle>
            <div className="p-4 border-b">
                <Input placeholder="Rechercher..." value={term} onChange={e => setTerm(e.target.value)} autoFocus />
            </div>
            <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 cursor-pointer border-b">
                <PlusCircle className="h-4 w-4" /> Nouveau Fournisseur
            </div>
            <div className="flex-1 overflow-auto p-0 max-h-[400px]">
                {filtered.map((s: any) => (
                    <div key={s.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(s)}>
                        {s.name}
                    </div>
                ))}
            </div>
            <div className="p-2 border-t flex justify-end"><Button variant="outline" onClick={()=>onOpenChange(false)}>Fermer</Button></div>
        </DialogContent>
        </Dialog>
    )
}

const ArticleSearchDialog = ({ isOpen, onOpenChange, onSelect, articles, onCreateNew }: any) => {
    const [term, setTerm] = useState("")
    const filtered = useMemo(() => {
        if (!term) return articles;
        return articles.filter((a:any) => a.name.toLowerCase().includes(term.toLowerCase()) || a.code.toLowerCase().includes(term.toLowerCase()));
    }, [term, articles]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
            <DialogTitle className="sr-only">Rechercher</DialogTitle>
            <div className="p-4 border-b">
                <Input placeholder="Rechercher..." value={term} onChange={e => setTerm(e.target.value)} autoFocus />
            </div>
            <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 cursor-pointer border-b">
                <PlusCircle className="h-4 w-4" /> Nouvel Article
            </div>
            <div className="flex-1 overflow-auto p-0 max-h-[400px]">
                {filtered.map((a: any) => (
                    <div key={a.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer flex justify-between" onClick={() => onSelect(a)}>
                        <span>{a.code} - {a.name}</span>
                        <span>{a.price} €</span>
                    </div>
                ))}
            </div>
            <div className="p-2 border-t flex justify-end"><Button variant="outline" onClick={()=>onOpenChange(false)}>Fermer</Button></div>
        </DialogContent>
        </Dialog>
    )
}

const RepresentativeSelector = ({ value, onChange, representatives, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = representatives.find((r:any) => r.id === value);
    return (
        <div className="flex gap-1 w-full">
            <div onClick={onOpenAdvanced} className={cn("flex-1 border rounded-md px-3 py-2 text-sm cursor-pointer truncate flex items-center bg-white", hasError && "border-red-500 bg-red-50")}>
                {selected ? selected.name : <span className="text-muted-foreground">Sélectionner...</span>}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onOpenAdvanced} className="shrink-0"><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const SupplierSelector = ({ value, onChange, suppliers, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = suppliers.find((s:any) => s.id === value);
    return (
        <div className="flex gap-1 w-full">
            <div onClick={onOpenAdvanced} className={cn("flex-1 border rounded-md px-3 py-2 text-sm cursor-pointer truncate flex items-center bg-white", hasError && "border-red-500 bg-red-50")}>
                {selected ? selected.name : <span className="text-muted-foreground">Sélectionner...</span>}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onOpenAdvanced} className="shrink-0"><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const ArticleSelector = ({ value, onChange, articles, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = articles.find((a:any) => a.id === value);
    return (
        <div className="flex gap-1 w-full">
             <div className={cn("flex-1 border rounded-md px-3 py-2 text-sm truncate cursor-pointer flex items-center bg-white h-9", hasError && "border-red-500")} onClick={onOpenAdvanced}>
                {selected ? selected.name : <span className="text-muted-foreground">Saisir un article...</span>}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onOpenAdvanced} className="h-9 w-9 shrink-0"><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const DatePickerField = ({ selected, onSelect, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal">{selected ? format(selected, 'dd/MM/yyyy') : placeholder}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3">
                    {/* Simplified Calendar Placeholder to prevent errors - implement actual Calendar component if needed */}
                    <div className="text-center text-sm p-2 cursor-pointer hover:bg-slate-100 rounded" onClick={() => { onSelect(new Date()); setIsOpen(false); }}>Aujourd'hui (Click to Select)</div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// --- MAIN COMPONENT ---
export function TestResizableDialog() {
  const [open, setOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  // DRAG STATE
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 }) // Mouse start
  const initialDialogPos = useRef({ x: 0, y: 0 }) // Dialog start

  const [size, setSize] = useState({ width: 900, height: 600 })
  const [dockOffset, setDockOffset] = useState(0) 
  
  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingReceipts, setExistingReceipts] = useState<PurchaseReceipt[]>([])
  
  const [receiptNumber, setReceiptNumber] = useState("BR-0001")
  const [remarks, setRemarks] = useState("") 
  const [formErrors, setFormErrors] = useState<any>({}) 
  const [isHoveringDock, setIsHoveringDock] = useState(false)

  const { toast } = useToast()

  const [date, setDate] = useState<Date>(new Date())
  const [dueDate, setDueDate] = useState<Date>(new Date())
  const [supplierId, setSupplierId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [representativeId, setRepresentativeId] = useState<string>("")
  const [reference, setReference] = useState<string>("")
  
  const [items, setItems] = useState<InvoiceItem[]>([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }])
  
  // Lists
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [reps, setReps] = useState<Representative[]>([])

  // Search Dialog States
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchTargetRowId, setSearchTargetRowId] = useState<string|null>(null)
  const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false) 
  const [isRepresentativeSearchOpen, setIsRepresentativeSearchOpen] = useState(false) 
  
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false)
  const [pendingRowId, setPendingRowId] = useState<string|null>(null)
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false)
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false)

  const db = useFirestore()

  // --- LOGIC ---
  const calculateNext = (list: PurchaseReceipt[]) => {
      if(!list.length) return "BR-0001";
      const max = list.reduce((m, r) => Math.max(m, parseInt(r.receiptNumber.replace("BR-", "")||"0", 10)), 0);
      return `BR-${(max+1).toString().padStart(4, '0')}`;
  }

  const { totalHT, totalTTC } = items.reduce((acc, i) => {
      const ht = i.price * i.qty;
      return { totalHT: acc.totalHT + ht, totalTTC: acc.totalTTC + ht * (1 + i.tva/100) };
  }, { totalHT: 0, totalTTC: 0 });

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
            setReceiptNumber(calculateNext(recList));
        }
        load();
    }
  }, [open, db]);

  useEffect(() => {
    const sidebar = document.querySelector('aside');
    if (sidebar) setDockOffset(sidebar.getBoundingClientRect().width);
  }, []);

  const handleOpen = () => {
      setPosition({ x: 0, y: 0 });
      setOpen(true);
      setIsMinimized(false);
  }

  const handleDragStart = (e: React.MouseEvent) => {
      if (isMinimized || e.target !== e.currentTarget) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      initialDialogPos.current = { ...position };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
  }

  const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      setPosition({
          x: initialDialogPos.current.x + dx,
          y: initialDialogPos.current.y + dy
      });
  }

  const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
  }

  const handleSave = async () => {
      if (!supplierId || !receiptNumber || !items.find(i=>i.articleId)) {
          setFormErrors({ supplier: !supplierId, receiptNumber: !receiptNumber, items: !items.find(i=>i.articleId) });
          setIsShaking(true); setTimeout(() => setIsShaking(false), 400); return;
      }
      setIsSubmitting(true);
      try {
          await addDocumentNonBlocking(collection(db!, "purchaseReceipts"), {
              receiptNumber, supplierId, representativeId, reference, remarks,
              receiptDate: date.toISOString(), dueDate: dueDate.toISOString(),
              items: items.filter(i=>i.articleId).map(i=>({ productId: i.articleId, quantityReceived: i.qty, price: i.price, tvaRate: i.tva })),
              totalHT, totalTTC, status: "Brouillon", paymentMode: paymentMethod
          });
          toast({ title: "Succès", description: "Bon créé" });
          setOpen(false);
          // reset
          setSupplierId(""); setRepresentativeId(""); setRemarks(""); setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }]);
          setReceiptNumber(calculateNext(existingReceipts));
      } catch (e) { console.error(e); }
      setIsSubmitting(false);
  }

  // --- RENDER ---
  return (
    <>
      <Button variant="outline" onClick={handleOpen}>Open Test Dialog</Button>

      {open && (
        // OVERLAY
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
             {!isMinimized && <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setOpen(false)} />}
             
             <div 
                className={cn(
                    "bg-white border shadow-xl flex flex-col pointer-events-auto transition-all duration-200",
                    isMinimized ? "fixed bottom-0 left-0 rounded-t-lg" : "fixed rounded-lg",
                    isShaking && "animate-shake"
                )}
                style={{
                    // MANUAL POSITIONING: Center start + Drag Delta
                    left: isMinimized ? (dockOffset + 20) + "px" : `calc(50% + ${position.x}px)`,
                    top: isMinimized ? "auto" : `calc(50% + ${position.y}px)`,
                    bottom: isMinimized ? "0px" : "auto",
                    width: isMinimized ? (isHoveringDock ? 600 : 280) : size.width,
                    height: isMinimized ? (isHoveringDock ? 500 : "auto") : size.height,
                    maxHeight: isMinimized ? "none" : "85vh", // STRICT MAX HEIGHT
                    
                    // Compound Transform
                    transform: isMinimized ? 'none' : 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => isMinimized && setIsHoveringDock(true)}
                onMouseLeave={() => setIsHoveringDock(false)}
             >
                {/* HEADER */}
                <div onMouseDown={handleDragStart} className={cn("bg-slate-100 p-3 border-b flex justify-between items-center select-none", !isMinimized && "cursor-move")}>
                    <span className="font-semibold text-sm">{isMinimized ? `Bon ${receiptNumber}` : "Nouveau Bon de Réception"}</span>
                    <div className="flex gap-2">
                        <Minus className="h-4 w-4 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)} />
                        <X className="h-4 w-4 cursor-pointer text-red-500" onClick={() => setOpen(false)} />
                    </div>
                </div>

                {/* BODY */}
                <div className={cn("flex-1 flex flex-col min-h-0 bg-white overflow-hidden", isMinimized && !isHoveringDock && "hidden")}>
                    
                    {/* SCROLLABLE MIDDLE */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="flex gap-4">
                            <div className="w-1/2 space-y-3 p-3 border rounded">
                                <Label>Numéro *</Label>
                                <Input value={receiptNumber} onChange={e=>setReceiptNumber(e.target.value)} />
                                <Label>Date</Label>
                                <DatePickerField selected={date} onSelect={setDate} placeholder="Date" />
                            </div>
                            <div className="w-1/2 space-y-3 p-3 border rounded">
                                <Label>Fournisseur *</Label>
                                <SupplierSelector value={supplierId} onChange={setSupplierId} suppliers={suppliers} onOpenAdvanced={()=>setIsSupplierSearchOpen(true)} onCreateNew={()=>setIsCreateSupplierOpen(true)} hasError={formErrors.supplier} />
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className={cn("border rounded p-0 overflow-hidden", formErrors.items && "border-red-500")}>
                            <div className="bg-slate-50 p-2 text-xs font-semibold grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 border-b">
                                <span>Article</span><span>Qté</span><span>Prix</span><span>Total</span><span></span>
                            </div>
                            {items.map(item => (
                                <div key={item.id} className="p-2 border-b grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 items-center text-sm">
                                    <ArticleSelector value={item.articleId} onChange={(v:string) => {
                                        const art = articles.find(a=>a.id===v);
                                        setItems(prev=>prev.map(i=>i.id===item.id ? {...i, articleId:v, price: art?.price||0, tva: art?.tva||20} : i))
                                    }} articles={articles} onOpenAdvanced={()=>{setSearchTargetRowId(item.id); setIsSearchOpen(true)}} onCreateNew={()=>{setPendingRowId(item.id); setIsCreateArticleOpen(true)}} />
                                    <Input type="number" className="h-8" value={item.qty} onChange={e => setItems(prev=>prev.map(i=>i.id===item.id ? {...i, qty: Number(e.target.value)} : i))} />
                                    <Input type="number" className="h-8" value={item.price} onChange={e => setItems(prev=>prev.map(i=>i.id===item.id ? {...i, price: Number(e.target.value)} : i))} />
                                    <div className="text-right content-center">{(item.qty * item.price).toFixed(2)}</div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setItems(items.filter(i=>i.id!==item.id))}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button variant="ghost" className="w-full rounded-none h-9 text-xs hover:bg-slate-50" onClick={() => setItems([...items, {id:generateId(), articleId:"", qty:1, price:0, tva:20}])}>+ Ajouter</Button>
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
                        <div className="text-sm">
                            <span className="text-muted-foreground">Total HT: </span>{totalHT.toFixed(2)} € <span className="font-bold ml-4">TTC: {totalTTC.toFixed(2)} €</span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                            <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4"/> : "Créer"}</Button>
                        </div>
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* SEARCH/CREATE DIALOGS */}
      <RepresentativeSearchDialog isOpen={isRepresentativeSearchOpen} onOpenChange={setIsRepresentativeSearchOpen} onSelect={(r:any)=>{setRepresentativeId(r.id); setIsRepresentativeSearchOpen(false)}} representatives={reps} onCreateNew={()=>{setIsRepresentativeSearchOpen(false); setIsCreateRepOpen(true)}} />
      <SupplierSearchDialog isOpen={isSupplierSearchOpen} onOpenChange={setIsSupplierSearchOpen} onSelect={(s:any)=>{setSupplierId(s.id); setIsSupplierSearchOpen(false)}} suppliers={suppliers} onCreateNew={()=>{setIsSupplierSearchOpen(false); setIsCreateSupplierOpen(true)}} />
      <ArticleSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} onSelect={(a:any)=>{ if(searchTargetRowId) setItems(prev=>prev.map(i=>i.id===searchTargetRowId ? {...i, articleId:a.id, price:a.price, tva:a.tva||20} : i)); setIsSearchOpen(false); }} articles={articles} onCreateNew={()=>{setIsSearchOpen(false); if(searchTargetRowId) { setPendingRowId(searchTargetRowId); setIsCreateArticleOpen(true); } }} />
      
      <ArticleDialog isOpen={isCreateArticleOpen} onOpenChange={setIsCreateArticleOpen} onArticleCreated={(a:any)=>{ setArticles(prev=>[a,...prev]); if(pendingRowId) setItems(prev=>prev.map(i=>i.id===pendingRowId ? {...i, articleId:a.id, price:a.price, tva:a.tva||20} : i)); }} articles={articles} isChild={true} />
      <RepresentativeDialog isOpen={isCreateRepOpen} onOpenChange={setIsCreateRepOpen} onRepresentativeCreated={(r:any)=>{setReps(prev=>[r,...prev]); setRepresentativeId(r.id)}} representatives={reps} />
      <SupplierDialog isOpen={isCreateSupplierOpen} onOpenChange={setIsCreateSupplierOpen} onSupplierCreated={(s:any)=>{setSuppliers(prev=>[s,...prev]); setSupplierId(s.id)}} suppliers={suppliers} />
    </>
  )
}
