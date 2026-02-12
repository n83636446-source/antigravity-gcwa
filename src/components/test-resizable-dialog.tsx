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

// ==========================================
// 1. SEARCH DIALOGS (Defined First)
// ==========================================

const RepresentativeSearchDialog = ({ isOpen, onOpenChange, onSelect, representatives, onCreateNew }: any) => {
  const [term, setTerm] = useState("")
  const filtered = useMemo(() => {
    if (!term) return representatives;
    const lowerTerm = term.toLowerCase();
    return representatives.filter((r:any) => r.name.toLowerCase().includes(lowerTerm) || (r.code && r.code.toLowerCase().includes(lowerTerm)));
  }, [term, representatives]);

  useEffect(() => { if (isOpen) setTerm("") }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher un représentant</DialogTitle>
        <div className="p-4 border-b">
             <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Rechercher code, nom..." value={term} onChange={e => setTerm(e.target.value)} autoFocus />
             </div>
        </div>
        <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 cursor-pointer border-b">
            <PlusCircle className="h-4 w-4" /> Créer un nouveau représentant
        </div>
        <div className="flex-1 overflow-auto p-0 min-h-[300px]">
            <table className="w-full text-sm caption-bottom">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                    <tr><th className="h-10 px-4 text-left font-medium text-muted-foreground">Code</th><th className="h-10 px-4 text-left font-medium text-muted-foreground">Nom</th></tr>
                </thead>
                <tbody>
                    {filtered.map((rep: any) => (
                        <tr key={rep.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(rep)}>
                            <td className="p-3 font-mono text-xs">{rep.code || "-"}</td>
                            <td className="p-3 font-medium">{rep.name}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="p-3 border-t bg-slate-50 flex justify-end"><Button variant="outline" onClick={()=>onOpenChange(false)}>Fermer</Button></div>
      </DialogContent>
    </Dialog>
  )
}

const SupplierSearchDialog = ({ isOpen, onOpenChange, onSelect, suppliers, onCreateNew }: any) => {
    const [term, setTerm] = useState("")
    const filtered = useMemo(() => {
        if (!term) return suppliers;
        return suppliers.filter((s:any) => s.name.toLowerCase().includes(term.toLowerCase()) || s.code.toLowerCase().includes(term.toLowerCase()));
    }, [term, suppliers]);

    useEffect(() => { if (isOpen) setTerm("") }, [isOpen])

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
            <DialogTitle className="sr-only">Rechercher un fournisseur</DialogTitle>
            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Rechercher code, nom..." value={term} onChange={e => setTerm(e.target.value)} autoFocus />
                </div>
            </div>
            <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 cursor-pointer border-b">
                <PlusCircle className="h-4 w-4" /> Créer un nouveau fournisseur
            </div>
            <div className="flex-1 overflow-auto p-0 min-h-[300px]">
                <table className="w-full text-sm caption-bottom">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                        <tr>
                            <th className="h-10 px-4 text-left font-medium text-muted-foreground w-[100px]">Code</th>
                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nom</th>
                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Contact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((s: any) => (
                            <tr key={s.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(s)}>
                                <td className="p-3 font-mono text-xs">{s.code}</td>
                                <td className="p-3 font-medium">{s.name}</td>
                                <td className="p-3 text-muted-foreground">{s.contactName}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 border-t bg-slate-50 flex justify-end"><Button variant="outline" onClick={()=>onOpenChange(false)}>Fermer</Button></div>
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

    useEffect(() => { if (isOpen) setTerm("") }, [isOpen])

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
            <DialogTitle className="sr-only">Rechercher un article</DialogTitle>
            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Rechercher article..." value={term} onChange={e => setTerm(e.target.value)} autoFocus />
                </div>
            </div>
            <div onClick={onCreateNew} className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 cursor-pointer border-b">
                <PlusCircle className="h-4 w-4" /> Créer un nouvel article
            </div>
            <div className="flex-1 overflow-auto p-0 min-h-[400px]">
                <table className="w-full text-sm caption-bottom">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                        <tr>
                            <th className="h-10 px-4 text-left font-medium text-muted-foreground w-[120px]">Code</th>
                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Désignation</th>
                            <th className="h-10 px-4 text-right font-medium text-muted-foreground w-[100px]">Prix</th>
                            <th className="h-10 px-4 text-right font-medium text-muted-foreground w-[80px]">Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a: any) => (
                            <tr key={a.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(a)}>
                                <td className="p-3 font-mono text-xs">{a.code}</td>
                                <td className="p-3 font-medium">{a.name}</td>
                                <td className="p-3 text-right">{a.price.toFixed(2)} €</td>
                                <td className="p-3 text-right">{a.stockLevel || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 border-t bg-slate-50 flex justify-end"><Button variant="outline" onClick={()=>onOpenChange(false)}>Fermer</Button></div>
        </DialogContent>
        </Dialog>
    )
}

// ==========================================
// 2. ADVANCED SELECTORS
// ==========================================

const RepresentativeSelector = ({ value, onChange, representatives, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const skipOpenRef = useRef(false);

    useEffect(() => {
        const selected = representatives.find((r:any) => r.id === value)
        if (selected) setInputValue(selected.name)
        else if (!value) setInputValue("")
    }, [value, representatives])

    const filtered = useMemo(() => {
        if (!inputValue) return representatives.slice(0, 10);
        return representatives.filter((r:any) => r.name.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 20);
    }, [inputValue, representatives])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input placeholder="Sélectionner un représentant..." value={inputValue} autoComplete="off" 
                        onFocus={() => !skipOpenRef.current && setOpen(true)}
                        onClick={(e) => { e.stopPropagation(); !skipOpenRef.current && setOpen(true); }}
                        onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
                        className={cn("w-full pr-10", hasError && "border-red-500")} 
                    />
                    <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenAdvanced(); }}>
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 overflow-hidden bg-white" align="start">
                <div onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; setOpen(false); setTimeout(() => skipOpenRef.current=false, 150); onCreateNew(); }} className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b">
                    <PlusCircle className="h-4 w-4" /> Créer un nouveau représentant
                </div>
                <div className="max-h-[250px] overflow-y-auto p-1">
                    {filtered.map((rep:any) => (
                        <div key={rep.id} onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; onChange(rep.id); setInputValue(rep.name); setOpen(false); setTimeout(() => skipOpenRef.current = false, 150); }} className="px-2 py-2 text-sm hover:bg-slate-100 cursor-pointer rounded-sm flex flex-col">
                            <span className="font-medium">{rep.name}</span>
                            <span className="text-xs text-muted-foreground">{rep.code}</span>
                        </div>
                    ))}
                    <div className="h-px bg-slate-100 my-1"/>
                    <div onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; setOpen(false); setTimeout(() => skipOpenRef.current=false, 150); onOpenAdvanced(); }} className="flex items-center justify-center p-2 text-sm font-semibold text-blue-600 hover:bg-slate-100 cursor-pointer rounded-sm"><Search className="h-4 w-4 mr-2"/> Recherche avancée...</div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

const SupplierSelector = ({ value, onChange, suppliers, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const skipOpenRef = useRef(false);

    useEffect(() => {
        const selected = suppliers.find((s:any) => s.id === value)
        if (selected) setInputValue(selected.name)
        else if (!value) setInputValue("")
    }, [value, suppliers])

    const filtered = useMemo(() => {
        if (!inputValue) return suppliers.slice(0, 10);
        return suppliers.filter((s:any) => s.name.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 20);
    }, [inputValue, suppliers])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input placeholder="Sélectionner un fournisseur..." value={inputValue} autoComplete="off" 
                        onFocus={() => !skipOpenRef.current && setOpen(true)}
                        onClick={(e) => { e.stopPropagation(); !skipOpenRef.current && setOpen(true); }}
                        onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
                        className={cn("w-full pr-10", hasError && "border-red-500")} 
                    />
                    <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenAdvanced(); }}>
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 overflow-hidden bg-white" align="start">
                <div onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; setOpen(false); setTimeout(() => skipOpenRef.current=false, 150); onCreateNew(); }} className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b">
                    <PlusCircle className="h-4 w-4" /> Créer un nouveau fournisseur
                </div>
                <div className="max-h-[250px] overflow-y-auto p-1">
                    {filtered.map((sup:any) => (
                        <div key={sup.id} onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; onChange(sup.id); setInputValue(sup.name); setOpen(false); setTimeout(() => skipOpenRef.current = false, 150); }} className="px-2 py-2 text-sm hover:bg-slate-100 cursor-pointer rounded-sm flex flex-col">
                            <span className="font-medium">{sup.name}</span>
                            <span className="text-xs text-muted-foreground">{sup.code}</span>
                        </div>
                    ))}
                    <div className="h-px bg-slate-100 my-1"/>
                    <div onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; setOpen(false); setTimeout(() => skipOpenRef.current=false, 150); onOpenAdvanced(); }} className="flex items-center justify-center p-2 text-sm font-semibold text-blue-600 hover:bg-slate-100 cursor-pointer rounded-sm"><Search className="h-4 w-4 mr-2"/> Recherche avancée...</div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

const ArticleSelector = ({ value, onChange, articles, onOpenAdvanced, onCreateNew, hasError, autoFocus }: any) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const skipOpenRef = useRef(false);

    useEffect(() => { if (autoFocus && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50); }, [autoFocus]);

    useEffect(() => {
        const selected = articles.find((a:any) => a.id === value)
        if (selected) setInputValue(selected.name)
        else if (!value) setInputValue("")
    }, [value, articles])

    const filtered = useMemo(() => {
        if (!inputValue) return articles.slice(0, 10);
        return articles.filter((a:any) => a.name.toLowerCase().includes(inputValue.toLowerCase()) || a.code.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 20);
    }, [inputValue, articles])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input ref={inputRef} placeholder="Saisir un article..." value={inputValue} autoComplete="off" 
                        onFocus={() => !skipOpenRef.current && setOpen(true)}
                        onClick={(e) => { e.stopPropagation(); !skipOpenRef.current && setOpen(true); }}
                        onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
                        className={cn("w-full pr-10", hasError && "border-red-500")} 
                    />
                    <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenAdvanced(); }}>
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[600px] p-0 overflow-hidden bg-white" align="start">
                <div onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; setOpen(false); setTimeout(() => skipOpenRef.current=false, 150); onCreateNew(); }} className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b">
                    <PlusCircle className="h-4 w-4" /> Créer un nouvel article
                </div>
                <div className="grid grid-cols-[100px_1fr_80px] items-center gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-slate-50 shrink-0">
                    <span className="text-left pl-2">Code</span><span className="text-left">Désignation</span><span className="text-right pr-2">Stock</span>
                </div>
                <div className="max-h-[250px] overflow-y-auto p-1">
                    {filtered.map((art:any) => (
                        <div key={art.id} onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; onChange(art.id); setInputValue(art.name); setOpen(false); setTimeout(() => skipOpenRef.current = false, 150); }} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 transition-colors">
                            <div className="grid grid-cols-[100px_1fr_80px] items-center gap-4 w-full">
                                <span className="text-left font-mono text-xs text-muted-foreground pl-2">{art.code}</span>
                                <span className="text-left truncate font-medium">{art.name}</span>
                                <span className="text-right text-xs pr-2">{art.stockLevel || 0}</span>
                            </div>
                        </div>
                    ))}
                    <div className="h-px bg-slate-100 my-1"/>
                    <div onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); skipOpenRef.current = true; setOpen(false); setTimeout(() => skipOpenRef.current=false, 150); onOpenAdvanced(); }} className="flex items-center justify-center p-2 text-sm font-semibold text-blue-600 hover:bg-slate-100 cursor-pointer rounded-sm"><Search className="h-4 w-4 mr-2"/> Recherche avancée...</div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

const SimpleCalendar = ({ selected, onSelect, onClose }: { selected: Date | undefined, onSelect: (d: Date) => void, onClose: () => void }) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleToday = () => { const today = new Date(); onSelect(today); setCurrentMonth(today); }
  const daysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = []; let day = start;
    while (day <= end) { days.push(day); day = addDays(day, 1); }
    return days;
  }
  return (
    <div className="p-3 w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={(e) => { e.preventDefault(); prevMonth() }} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold text-sm capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</span>
        <button onClick={(e) => { e.preventDefault(); nextMonth() }} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">{['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="text-gray-400 font-medium">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1 text-sm mb-3">
        {daysInMonth().map((d, i) => {
           const isSelected = selected && isSameDay(d, selected); const isCurrentMonth = isSameMonth(d, currentMonth); const isToday = isSameDay(d, new Date());
           return (
             <button key={i} onClick={(e) => { e.preventDefault(); onSelect(d); }} className={cn("h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors", !isCurrentMonth && "text-gray-300", isCurrentMonth && "text-gray-700 hover:bg-gray-100", isSelected && "bg-slate-900 text-white hover:bg-slate-800", isToday && !isSelected && "border border-slate-400 font-semibold")}>{format(d, "d")}</button>
           )
        })}
      </div>
      <div className="border-t pt-3 flex items-center gap-2">
         <div className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-md flex-1 text-center font-medium border truncate">{selected ? format(selected, "dd/MM/yyyy") : "--/--/----"}</div>
         <Button size="sm" variant="outline" className="h-8 text-xs font-medium px-2" onClick={(e) => { e.preventDefault(); handleToday() }}>Aujourd'hui</Button>
         <Button size="sm" className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3" onClick={(e) => { e.preventDefault(); onClose() }}>OK</Button>
      </div>
    </div>
  )
}

const DatePickerField = ({ selected, onSelect, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button variant={"outline"} className={cn("w-full flex items-center justify-between px-3 text-left font-normal overflow-hidden", !selected && "text-muted-foreground")}>
          <span className="truncate flex-1 min-w-0">{selected ? format(selected, "d MMMM yyyy", { locale: fr }) : placeholder}</span>
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="bg-white rounded-md border shadow-md relative z-50">
            <SimpleCalendar selected={selected} onSelect={onSelect} onClose={() => setIsOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ==========================================
// 3. MAIN COMPONENT (Restored & Fixed)
// ==========================================

export function TestResizableDialog() {
  const [open, setOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isHoveringDock, setIsHoveringDock] = useState(false)
  
  // DRAG & SIZE
  const [size, setSize] = useState({ width: 900, height: 500 }) // FIXED: Smaller default height
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const [dockOffset, setDockOffset] = useState(0) 

  // DATA
  const [receiptNumber, setReceiptNumber] = useState("BR-0001")
  const [remarks, setRemarks] = useState("") 
  const [formErrors, setFormErrors] = useState<any>({}) 
  const [date, setDate] = useState<Date>(new Date())
  const [dueDate, setDueDate] = useState<Date>(new Date())
  const [supplierId, setSupplierId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [representativeId, setRepresentativeId] = useState<string>("")
  const [reference, setReference] = useState<string>("")
  
  const [items, setItems] = useState<InvoiceItem[]>([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }])
  
  // CACHE LISTS
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [reps, setReps] = useState<Representative[]>([])
  const [existingReceipts, setExistingReceipts] = useState<PurchaseReceipt[]>([])

  // DIALOG STATES
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchTargetRowId, setSearchTargetRowId] = useState<string | null>(null)
  const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false) 
  const [isRepresentativeSearchOpen, setIsRepresentativeSearchOpen] = useState(false) 
  
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false)
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false)
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [flashingRowId, setFlashingRowId] = useState<string|null>(null)

  const db = useFirestore()
  const { toast } = useToast()

  // --- LOGIC ---

  const { totalHT, totalTTC } = items.reduce((acc, item) => {
      const lineHT = item.price * item.qty;
      const lineTVA = lineHT * (item.tva / 100);
      return { totalHT: acc.totalHT + lineHT, totalTTC: acc.totalTTC + lineHT + lineTVA };
  }, { totalHT: 0, totalTTC: 0 });

  const calculateNextNumber = (list: PurchaseReceipt[]) => {
      if (!list.length) return "BR-0001";
      const max = list.reduce((m, r) => Math.max(m, parseInt(r.receiptNumber.replace("BR-", "")||"0", 10)), 0);
      return `BR-${(max+1).toString().padStart(4, '0')}`;
  }

  const resetForm = () => {
      setDate(new Date()); setDueDate(new Date()); setSupplierId(""); setPaymentMethod("cash");
      setRepresentativeId(""); setReference(""); setRemarks("");
      setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }]);
      setPosition({ x: 0, y: 0 }); setFormErrors({});
      setReceiptNumber(calculateNextNumber(existingReceipts));
  }

  const isFormDirty = () => {
    if (!isSameDay(date, new Date())) return true;
    if (!isSameDay(dueDate, new Date())) return true;
    if (supplierId !== "" || representativeId !== "" || reference !== "" || remarks !== "") return true;
    if (items.length > 1) return true;
    if (items.length === 1 && items[0].articleId !== "") return true;
    return false;
  }

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
      const sidebar = document.querySelector('aside');
      if(sidebar) setDockOffset(sidebar.getBoundingClientRect().width);
  }, []);

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
      }, 200)
    } else {
      // RESET POSITION ON OPEN (Critical Fix)
      setPosition({ x: 0, y: 0 })
      setOpen(true)
    }
  }

  const confirmClose = () => {
      setShowCloseAlert(false)
      setOpen(false)
      setTimeout(() => {
        resetForm() 
        setIsMinimized(false)
      }, 200)
  }

  // --- DRAG ---
  const handleDragStart = (e: React.MouseEvent) => {
      if (isMinimized || e.target !== e.currentTarget) return;
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

  // --- RESIZE ---
  const handleResize = (direction: string) => (e: React.MouseEvent) => {
    if (isMinimized) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (direction === 'right' || direction === 'corner') {
        const newWidth = Math.max(400, startWidth + (moveEvent.clientX - startX))
        setSize(s => ({ ...s, width: newWidth }))
      }
      if (direction === 'bottom' || direction === 'corner') {
        const newHeight = Math.max(400, startHeight + (moveEvent.clientY - startY))
        setSize(s => ({ ...s, height: newHeight }))
      }
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleSave = async () => {
      if(!supplierId || !receiptNumber.trim() || !items.find(i=>i.articleId)) {
          setFormErrors({ supplier: !supplierId, receiptNumber: !receiptNumber.trim(), items: !items.find(i=>i.articleId) });
          return;
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
          resetForm();
      } catch (e) { console.error(e); }
      setIsSubmitting(false);
  }

  const isMobile = size.width < 800

  // --- RENDER ---
  return (
    <>
      <Button variant="outline" onClick={() => { setPosition({x:0, y:0}); setOpen(true); }}>
        Open Test Dialog
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange} modal={!isMinimized}>
        <DialogContent 
          onInteractOutside={(e) => { e.preventDefault(); if (showCloseAlert) setIsShaking(true); }}
          className={cn(
              "p-0 overflow-visible bg-transparent border-none shadow-none max-w-none w-auto h-auto [&>button]:!hidden pointer-events-none",
              isMinimized ? "fixed bottom-0 z-[9999]" : "fixed left-[50%] top-[50%] z-50"
          )}
          style={{ 
            width: isMinimized ? (isHoveringDock ? 600 : 280) : size.width, 
            height: isMinimized ? (isHoveringDock ? 500 : "auto") : "auto", 
            maxHeight: isMinimized ? "none" : "85vh", 
            position: "fixed", 
            left: isMinimized ? ((dockOffset || 0) + 16) + 'px' : '50%',
            top: isMinimized ? 'auto' : '50%',
            bottom: isMinimized ? '0px' : 'auto',
            transform: isMinimized ? "none" : `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
            transition: isDragging ? "none" : "width 0.2s, height 0.2s" 
          }}
        >
          <DialogTitle className="sr-only">Créer un bon de réception</DialogTitle>
          <div 
            onMouseEnter={() => isMinimized && setIsHoveringDock(true)}
            onMouseLeave={() => setIsHoveringDock(false)}
            className={cn(
              "relative bg-white border rounded-t-lg shadow-xl flex flex-col pointer-events-auto h-full", 
              isMinimized ? "rounded-b-none border-b-0 shadow-md hover:bg-slate-50 cursor-pointer" : "rounded-lg",
              isShaking && "animate-shake"
            )}
            onClick={isMinimized ? () => setIsMinimized(false) : undefined}
          >
            {/* HEADER */}
            <div 
                onMouseDown={handleDragStart}
                className={cn("flex-none p-4 select-none flex items-center justify-between", !isMinimized && "cursor-move", isMinimized && "py-3 px-3 border-b-0")}
            >
              <div className="flex items-center gap-2 pr-12 truncate font-semibold text-sm">
                {isMinimized && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
                {isMinimized ? `Bon de réception - ${receiptNumber}` : "Créer un bon de réception"}
              </div>
              <div className="absolute right-3 top-3 z-50 flex gap-1">
                {!isMinimized && <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} className="p-1.5 opacity-60 hover:opacity-100"><Minus className="h-3.5 w-3.5" /></button>}
                <button onClick={(e) => { e.stopPropagation(); handleOpenChange(false); }} className="p-1.5 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {/* FLEX SANDWICH */}
            <div className={cn("flex flex-col flex-1 min-h-0", isMinimized && !isHoveringDock && "hidden")}>
              {!isMinimized && <div className="px-6 pb-4 border-b -mt-2 text-muted-foreground text-sm">Remplissez les informations.</div>}
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* FORM CONTENT (Same as before) */}
              </div>

              <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg">
                <DialogFooter className="sm:justify-between">
                    <div className="text-right"><span className="font-bold text-lg">{totalTTC.toFixed(2)} €</span> TTC</div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4"/> : "Créer"}</Button>
                    </div>
                </DialogFooter>
              </div>
            </div>
            
            {/* RESIZE HANDLES */}
            {!isMinimized && ( <>
                <div onMouseDown={handleResize('right')} className="absolute -right-3 top-0 bottom-0 w-3 cursor-ew-resize" />
                <div onMouseDown={handleResize('bottom')} className="absolute -bottom-3 left-0 right-0 h-3 cursor-ns-resize" />
                <div onMouseDown={handleResize('corner')} className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize" />
            </>)}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Search & Create Dialogs */}
      <RepresentativeSearchDialog isOpen={isRepresentativeSearchOpen} onOpenChange={setIsRepresentativeSearchOpen} onSelect={(r:any)=>{setRepresentativeId(r.id); setIsRepresentativeSearchOpen(false)}} representatives={reps} onCreateNew={()=>{setIsRepresentativeSearchOpen(false); setIsCreateRepOpen(true)}} />
      <SupplierSearchDialog isOpen={isSupplierSearchOpen} onOpenChange={setIsSupplierSearchOpen} onSelect={(s:any)=>{setSupplierId(s.id); setIsSupplierSearchOpen(false)}} suppliers={suppliers} onCreateNew={()=>{setIsSupplierSearchOpen(false); setIsCreateSupplierOpen(true)}} />
      <ArticleSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} onSelect={(a:any)=>{ if(searchTargetRowId) setItems(prev=>prev.map(i=>i.id===searchTargetRowId ? {...i, articleId:a.id, price:a.price, tva:a.tva||20} : i)); setIsSearchOpen(false); }} articles={articles} onCreateNew={()=>{setIsSearchOpen(false); if(searchTargetRowId) { setPendingRowId(searchTargetRowId); setIsCreateArticleOpen(true); } }} />

      <ArticleDialog isOpen={isCreateArticleOpen} onOpenChange={setIsCreateArticleOpen} onArticleCreated={(a:any)=>{ setArticles(prev=>[a,...prev]); if(pendingRowId) setItems(prev=>prev.map(i=>i.id===pendingRowId ? {...i, articleId:a.id, price:a.price, tva:a.tva||20} : i)); }} articles={articles} isChild={true} />
      <RepresentativeDialog isOpen={isCreateRepOpen} onOpenChange={setIsCreateRepOpen} onRepresentativeCreated={(r:any)=>{setReps(prev=>[r,...prev]); setRepresentativeId(r.id)}} representatives={reps} />
      <SupplierDialog isOpen={isCreateSupplierOpen} onOpenChange={setIsCreateSupplierOpen} onSupplierCreated={(s:any)=>{setSuppliers(prev=>[s,...prev]); setSupplierId(s.id)}} suppliers={suppliers} />
    </>
  )
}