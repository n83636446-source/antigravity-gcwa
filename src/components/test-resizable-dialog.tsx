import React, { useState, useEffect, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Keep Popover imports for DatePicker
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight, X, Minus, PlusCircle, Search, Check, Building2, User, Phone, Mail } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

// --- FIREBASE IMPORTS ---
import { collection, getDocs } from "firebase/firestore"
import { useFirestore } from "@/hooks/use-firestore" 
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

// --- HOOK: CLICK OUTSIDE ---
function useClickOutside(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);
        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [ref, handler]);
}

// --- COMPONENT: AUTOCOMPLETE SUPPLIER SELECTOR ---
const SupplierSelector = ({ 
    value, 
    onChange, 
    suppliers, 
    onOpenAdvanced,
    onCreateNew
}: { 
    value: string, 
    onChange: (id: string) => void, 
    suppliers: Supplier[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const wrapperRef = useRef<HTMLDivElement>(null)

    useClickOutside(wrapperRef, () => setOpen(false));

    useEffect(() => {
        const selected = suppliers.find(s => s.id === value)
        if (selected) {
            setInputValue(selected.name)
        } else if (!value) {
            setInputValue("")
        }
    }, [value, suppliers])

    const filteredSuppliers = useMemo(() => {
        if (!inputValue) return suppliers.slice(0, 10); 
        const lower = inputValue.toLowerCase()
        return suppliers.filter(s => 
            s.name.toLowerCase().includes(lower) || 
            s.code.toLowerCase().includes(lower)
        ).slice(0, 20); 
    }, [inputValue, suppliers])

    const handleSelect = (supplier: Supplier) => {
        onChange(supplier.id)
        setInputValue(supplier.name)
        setOpen(false)
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <Input
                    placeholder="Sélectionnez un fournisseur..."
                    value={inputValue}
                    autoComplete="off" 
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setInputValue(e.target.value)
                        setOpen(true)
                    }}
                    className="w-full pr-10" 
                />
                <Button 
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600"
                    onClick={(e) => {
                        e.preventDefault() 
                        e.stopPropagation() 
                        onOpenAdvanced()
                    }}
                    title="Recherche avancée"
                >
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            {open && (
                <div 
                    className="absolute top-full left-0 mt-1 w-[500px] z-[99999] bg-white border border-slate-200 rounded-md shadow-2xl overflow-hidden flex flex-col"
                    onMouseDown={(e) => e.preventDefault()} 
                >
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-slate-50 shrink-0">
                        <span className="text-left pl-2">Code</span>
                        <span className="text-left">Nom</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1">
                        <div 
                            onMouseDown={(e) => { 
                                e.stopPropagation();
                                setOpen(false); 
                                onCreateNew(); 
                            }} 
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <PlusCircle className="ml-2 h-4 w-4" />
                            Créer un nouveau fournisseur
                        </div>

                        <div className="h-px bg-slate-100 my-1" />
                        
                        {filteredSuppliers.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Aucun fournisseur trouvé.
                            </div>
                        )}

                        {filteredSuppliers.map((supplier) => (
                            <div
                                key={supplier.id}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleSelect(supplier);
                                }}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 transition-colors"
                            >
                                <div className="grid grid-cols-[100px_1fr] items-center gap-4 w-full">
                                    <span className="text-left font-mono text-xs text-muted-foreground pl-2">{supplier.code}</span>
                                    <span className="text-left truncate font-medium">{supplier.name}</span>
                                </div>
                                {value === supplier.id && <Check className="absolute right-2 h-4 w-4 opacity-50" />}
                            </div>
                        ))}

                        <div className="h-px bg-slate-100 my-1" />

                        <div 
                            onMouseDown={(e) => { 
                                e.stopPropagation();
                                setOpen(false); 
                                onOpenAdvanced();
                            }} 
                            className="flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold text-blue-600 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <Search className="h-4 w-4" />
                            Ouvrir la liste complète...
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- COMPONENT: ADVANCED SUPPLIER SEARCH DIALOG ---
const SupplierSearchDialog = ({ 
  isOpen, 
  onOpenChange, 
  onSelect, 
  suppliers 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (supplier: Supplier) => void;
  suppliers: Supplier[];
}) => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const lowerTerm = searchTerm.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(lowerTerm) || 
      s.code.toLowerCase().includes(lowerTerm)
    );
  }, [searchTerm, suppliers]);

  useEffect(() => {
    if (isOpen) setSearchTerm("")
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher un fournisseur</DialogTitle>
        <div className="p-4 border-b">
            <h2 className="text-lg font-semibold mb-2">Rechercher un fournisseur</h2>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer par code, nom..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
            </div>
        </div>
        <div className="flex-1 overflow-auto p-0">
            <table className="w-full caption-bottom text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm [&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">Code</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nom</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Contact</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[80px]"></th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {filteredSuppliers.length === 0 ? (
                        <tr className="border-b transition-colors">
                            <td colSpan={5} className="p-4 align-middle text-center py-8 text-muted-foreground">Aucun fournisseur trouvé.</td>
                        </tr>
                    ) : (
                        filteredSuppliers.map(supplier => (
                            <tr key={supplier.id} className="border-b transition-colors hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(supplier)}>
                                <td className="p-4 align-middle font-mono text-xs">{supplier.code}</td>
                                <td className="p-4 align-middle font-medium">{supplier.name}</td>
                                <td className="p-4 align-middle text-muted-foreground">{supplier.contactName || "-"}</td>
                                <td className="p-4 align-middle text-muted-foreground">{supplier.contactEmail || "-"}</td>
                                <td className="p-4 align-middle text-right"><Button size="sm" variant="secondary" className="h-7 text-xs">Choisir</Button></td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- COMPONENT: AUTOCOMPLETE ARTICLE SELECTOR ---
const ArticleSelector = ({ 
    value, 
    onChange, 
    articles, 
    onOpenAdvanced,
    onCreateNew,
    autoFocus = false
}: { 
    value: string, 
    onChange: (id: string) => void, 
    articles: Article[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    autoFocus?: boolean
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const wrapperRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useClickOutside(wrapperRef, () => setOpen(false));

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [autoFocus]);

    useEffect(() => {
        const selected = articles.find(a => a.id === value)
        if (selected) {
            setInputValue(selected.name)
        } else if (!value) {
            setInputValue("")
        }
    }, [value, articles])

    const filteredArticles = useMemo(() => {
        if (!inputValue) return articles.slice(0, 10); 
        const lower = inputValue.toLowerCase()
        return articles.filter(a => 
            a.name.toLowerCase().includes(lower) || 
            a.code.toLowerCase().includes(lower)
        ).slice(0, 20); 
    }, [inputValue, articles])

    const handleSelect = (article: Article) => {
        onChange(article.id)
        setInputValue(article.name)
        setOpen(false)
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <Input
                    ref={inputRef}
                    placeholder="Saisir un article..."
                    value={inputValue}
                    autoComplete="off" 
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setInputValue(e.target.value)
                        setOpen(true)
                    }}
                    className="w-full pr-10" 
                />
                <Button 
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600"
                    onClick={(e) => {
                        e.preventDefault() 
                        e.stopPropagation() 
                        onOpenAdvanced()
                    }}
                    title="Recherche avancée"
                >
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            {open && (
                <div 
                    className="absolute top-full left-0 mt-1 w-[600px] z-[99999] bg-white border border-slate-200 rounded-md shadow-2xl overflow-hidden flex flex-col"
                    onMouseDown={(e) => e.preventDefault()} 
                >
                    <div className="grid grid-cols-[100px_300px_100px] items-center gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-slate-50 shrink-0">
                        <span className="text-left pl-2">Code</span>
                        <span className="text-left">Désignation</span>
                        <span className="text-right pr-2">Stock</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1">
                        <div 
                            onMouseDown={(e) => { 
                                e.preventDefault(); 
                                setOpen(false); 
                                onCreateNew(); 
                            }} 
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <PlusCircle className="ml-2 h-4 w-4" />
                            Créer un nouvel article
                        </div>

                        <div className="h-px bg-slate-100 my-1" />
                        
                        {filteredArticles.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Aucun article trouvé.
                            </div>
                        )}

                        {filteredArticles.map((article) => (
                            <div
                                key={article.id}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(article);
                                }}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 transition-colors"
                            >
                                <div className="grid grid-cols-[100px_300px_100px] items-center gap-4 w-full">
                                    <span className="text-left font-mono text-xs text-muted-foreground pl-2">{article.code}</span>
                                    <span className="text-left truncate font-medium">{article.name}</span>
                                    <span className={cn(
                                        "text-right font-medium text-xs pr-2",
                                        (article.stockLevel || 0) <= (article.reorderThreshold || 0) ? "text-red-600 font-bold" : "text-muted-foreground"
                                    )}>
                                        {article.stockLevel ?? 0}
                                    </span>
                                </div>
                                {value === article.id && <Check className="absolute right-2 h-4 w-4 opacity-50" />}
                            </div>
                        ))}

                        <div className="h-px bg-slate-100 my-1" />

                        <div 
                            onMouseDown={(e) => { 
                                e.preventDefault();
                                setOpen(false); 
                                onOpenAdvanced();
                            }} 
                            className="flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold text-blue-600 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <Search className="h-4 w-4" />
                            Ouvrir la liste complète...
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- COMPONENT: ADVANCED ARTICLE SEARCH DIALOG ---
const ArticleSearchDialog = ({ 
  isOpen, 
  onOpenChange, 
  onSelect, 
  articles 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (article: Article) => void;
  articles: Article[];
}) => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredArticles = useMemo(() => {
    if (!searchTerm) return articles;
    const lowerTerm = searchTerm.toLowerCase();
    return articles.filter(a => 
      a.name.toLowerCase().includes(lowerTerm) || 
      a.code.toLowerCase().includes(lowerTerm)
    );
  }, [searchTerm, articles]);

  useEffect(() => {
    if (isOpen) setSearchTerm("")
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher un article</DialogTitle>
        <div className="p-4 border-b">
            <h2 className="text-lg font-semibold mb-2">Rechercher un article</h2>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer par code ou désignation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
            </div>
        </div>
        <div className="flex-1 overflow-auto p-0">
            <table className="w-full caption-bottom text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm [&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">Code</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Désignation</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px] text-right">Prix</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[80px] text-right">Stock</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[80px]"></th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {filteredArticles.length === 0 ? (
                        <tr className="border-b transition-colors">
                            <td colSpan={5} className="p-4 align-middle text-center py-8 text-muted-foreground">Aucun article trouvé.</td>
                        </tr>
                    ) : (
                        filteredArticles.map(article => (
                            <tr key={article.id} className="border-b transition-colors hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(article)}>
                                <td className="p-4 align-middle font-mono text-xs">{article.code}</td>
                                <td className="p-4 align-middle font-medium">{article.name}</td>
                                <td className="p-4 align-middle text-right">{article.price.toFixed(2)} €</td>
                                <td className={cn("p-4 align-middle text-right font-semibold", (article.stockLevel || 0) <= (article.reorderThreshold || 0) ? "text-red-600" : "text-slate-600")}>
                                    {article.stockLevel ?? 0}
                                </td>
                                <td className="p-4 align-middle text-right"><Button size="sm" variant="secondary" className="h-7 text-xs">Choisir</Button></td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- COMPONENT: CUSTOM CALENDAR ---
const SimpleCalendar = ({ selected, onSelect, onClose }: { selected: Date | undefined, onSelect: (d: Date) => void, onClose: () => void }) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleToday = () => {
    const today = new Date()
    onSelect(today)
    setCurrentMonth(today)
  }
  const daysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const days = []
    let day = start
    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }
  return (
    <div className="p-3 w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={(e) => { e.preventDefault(); prevMonth() }} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold text-sm capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</span>
        <button onClick={(e) => { e.preventDefault(); nextMonth() }} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
        {['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'].map((d, i) => <span key={`${d}-${i}`} className="text-gray-400 font-medium">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm mb-3">
        {daysInMonth().map((d, i) => {
           const isSelected = selected && isSameDay(d, selected)
           const isCurrentMonth = isSameMonth(d, currentMonth)
           const isToday = isSameDay(d, new Date())
           return (
             <button
               key={i}
               onClick={(e) => { e.preventDefault(); onSelect(d); }}
               className={cn(
                 "h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors",
                 !isCurrentMonth && "text-gray-300",
                 isCurrentMonth && "text-gray-700 hover:bg-gray-100",
                 isSelected && "bg-slate-900 text-white hover:bg-slate-800",
                 isToday && !isSelected && "border border-slate-400 font-semibold"
               )}
             >
               {format(d, "d")}
             </button>
           )
        })}
      </div>
      <div className="border-t pt-3 flex items-center gap-2">
         <div className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-md flex-1 text-center font-medium border truncate">
            {selected ? format(selected, "dd/MM/yyyy") : "--/--/----"}
         </div>
         <Button size="sm" variant="outline" className="h-8 text-xs font-medium px-2" onClick={(e) => { e.preventDefault(); handleToday() }}>
            Aujourd'hui
         </Button>
         <Button size="sm" className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3" onClick={(e) => { e.preventDefault(); onClose() }}>
            OK
         </Button>
      </div>
    </div>
  )
}

// --- DATE PICKER FIELD ---
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

export function TestResizableDialog() {
  const [open, setOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [size, setSize] = useState({ width: 1000, height: 800 })
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dockOffset, setDockOffset] = useState(0) 
  
  // --- ALERT STATE ---
  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const [isShaking, setIsShaking] = useState(false)

  // --- FORM STATE ---
  const [date, setDate] = useState<Date>(new Date())
  const [dueDate, setDueDate] = useState<Date>(new Date())
  const [supplierId, setSupplierId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [representativeId, setRepresentativeId] = useState<string>("")
  const [reference, setReference] = useState<string>("")
  
  // --- DATA STATE ---
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }
  ])
  const [availableArticles, setAvailableArticles] = useState<Article[]>([])
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([])
  const [availableRepresentatives, setAvailableRepresentatives] = useState<Representative[]>([])

  // --- FOCUS & MODAL STATE ---
  const [newRowId, setNewRowId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false) 
  const [searchTargetRowId, setSearchTargetRowId] = useState<string | null>(null)

  // --- FIRESTORE ---
  const db = useFirestore()

  // --- MODAL STATES ---
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false)
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false)
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  // --- RESET FUNCTION ---
  const resetForm = () => {
    setDate(new Date())
    setDueDate(new Date())
    setSupplierId("")
    setPaymentMethod("cash")
    setRepresentativeId("")
    setReference("")
    setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }])
    setPosition({ x: 0, y: 0 })
    setShowCloseAlert(false)
    setIsShaking(false)
  }

  // --- DIRTY CHECK ---
  const isFormDirty = () => {
    if (!isSameDay(date, new Date())) return true;
    if (!isSameDay(dueDate, new Date())) return true;
    if (supplierId !== "" || representativeId !== "" || reference !== "") return true;
    if (items.length > 1) return true;
    if (items.length === 1 && items[0].articleId !== "") return true;
    return false;
  }

  // --- CALCULATIONS ---
  const lastArticleCodeNumber = useMemo(() => {
    return availableArticles.reduce((max, article) => {
      const match = article.code.match(/ART(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
  }, [availableArticles]);

  const lastSupplierCodeNumber = useMemo(() => {
    return availableSuppliers.reduce((max, supplier) => {
      const match = supplier.code.match(/FOU(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
  }, [availableSuppliers]);

  const { totalHT, totalTVA, totalTTC } = items.reduce(
    (acc, item) => {
      const lineHT = item.price * item.qty;
      const lineTVA = lineHT * (item.tva / 100);
      return {
        totalHT: acc.totalHT + lineHT,
        totalTVA: acc.totalTVA + lineTVA,
        totalTTC: acc.totalTTC + lineHT + lineTVA,
      };
    },
    { totalHT: 0, totalTVA: 0, totalTTC: 0 }
  );

  // --- FETCH ALL DATA ---
  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      try {
        const [articlesSnap, suppliersSnap, repsSnap] = await Promise.all([
            getDocs(collection(db, "products")),
            getDocs(collection(db, "suppliers")),
            getDocs(collection(db, "representatives"))
        ])

        const articles = articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
        const suppliers = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[];
        const reps = repsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Representative[];

        setAvailableArticles(deduplicate(articles));
        setAvailableSuppliers(deduplicate(suppliers));
        setAvailableRepresentatives(deduplicate(reps));

      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }
    if (open && db) fetchData()
  }, [open, db])

  // --- SOUND EFFECT (DISSONANT BUZZER) ---
  const playWarningSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const t = ctx.currentTime;

      const createOsc = (freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square"; 
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.00001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t + 0.3);
      }

      createOsc(100); 
      createOsc(106); 

    } catch (e) {
      console.error("Audio play failed", e);
    }
  }

  // --- TABLE ACTIONS ---
  const addItem = () => {
    const id = generateId()
    const newItem = { id, articleId: "", qty: 1, price: 0, tva: 20 }
    setItems([...items, newItem])
    setNewRowId(id) 
  }

  const insertItemAfter = (currentId: string) => {
    const newId = generateId()
    const newItem = { id: newId, articleId: "", qty: 1, price: 0, tva: 20 }

    setItems(prevItems => {
        const index = prevItems.findIndex(item => item.id === currentId)
        if (index === -1) return prevItems
        
        // Create new array with item inserted at index + 1
        const newItems = [...prevItems]
        newItems.splice(index + 1, 0, newItem)
        return newItems
    })
    setNewRowId(newId) // Trigger auto-focus
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleLineChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
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

  const handleArticleChange = (rowId: string, value: string) => {
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

  // --- SEARCH DIALOG HANDLERS ---
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
      if (value === "create_new_rep") {
          setIsCreateRepOpen(true)
          return
      }
      setRepresentativeId(value)
  }

  const handleRepresentativeCreated = (newRep: any) => {
      const repWithType = newRep as Representative
      setAvailableRepresentatives(prev => deduplicate([repWithType, ...prev]))
      setRepresentativeId(repWithType.id)
  }

  const handleSupplierChange = (value: string) => {
      setSupplierId(value)
  }

  const handleSupplierSearchSelect = (supplier: Supplier) => {
      setSupplierId(supplier.id)
      setIsSupplierSearchOpen(false)
  }

  const handleSupplierCreated = (newSupplier: any) => {
      const supplierWithType = newSupplier as Supplier
      setAvailableSuppliers(prev => deduplicate([supplierWithType, ...prev]))
      setSupplierId(supplierWithType.id)
  }


  // --- ROBUST SIDEBAR TRACKING ---
  useEffect(() => {
    const getSidebarWidth = () => {
      const sidebar = document.querySelector('aside') || 
                      document.querySelector('[data-sidebar]') ||
                      document.querySelector('nav[class*="sidebar"]') ||
                      document.querySelector('.sidebar');
      
      if (!sidebar) return 0;
      
      const rect = sidebar.getBoundingClientRect();
      return rect.width > 10 ? rect.width : 0;
    }

    setDockOffset(getSidebarWidth());

    const interval = setInterval(() => {
       const w = getSidebarWidth();
       setDockOffset(w);
    }, 100); 

    return () => clearInterval(interval);
  }, [])

  // --- CONTROL LOGIC ---
  const handleMainButtonClick = () => {
    if (open) {
        if (isMinimized) setIsMinimized(false)
    } else {
        setOpen(true)
    }
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
      }, 200)
    } else {
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

  const handleOverlayClick = () => {
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 400)
      playWarningSound()
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMinimized) return
    if (e.target !== e.currentTarget && !e.currentTarget.contains(e.target as Node)) return
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startY = e.clientY
    const startPos = { ...position }
    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      setPosition({ x: startPos.x + dx, y: startPos.y + dy })
    }
    const onMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

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
        const newWidth = Math.max(350, startWidth + (moveEvent.clientX - startX))
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

  const isMobile = size.width < 800

  return (
    <>
      <Button variant="outline" onClick={handleMainButtonClick}>
        Open Test Dialog
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange} modal={!isMinimized}>
        <DialogContent 
          onInteractOutside={(e) => {
            e.preventDefault(); 
            // ALERT FIX: Shake if the alert is showing and user clicks backdrop
            if (showCloseAlert) {
                handleOverlayClick();
                return;
            }
            if (isMinimized) return; 
          }}
          className={cn(
              "p-0 overflow-visible bg-transparent border-none shadow-none max-w-none w-auto h-auto transition-all duration-100 ease-in-out [&>button]:!hidden pointer-events-none",
              isMinimized 
                ? "fixed bottom-0 top-auto right-auto translate-x-0 translate-y-0 z-[9999]"
                : "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50"
          )}
          style={isMinimized ? { left: (dockOffset || 0) + 16, transition: "left 0.2s ease-out" } : {}}
        >
          <div 
            onClick={isMinimized ? toggleMinimize : undefined}
            className={cn(
              "relative bg-white border rounded-t-lg shadow-xl flex flex-col pointer-events-auto",
              isMinimized ? "rounded-b-none border-b-0 shadow-md hover:bg-slate-50 cursor-pointer" : "rounded-lg",
              isDragging ? "transition-none" : "transition-all duration-100 ease-in-out"
            )}
            style={{ 
              width: isMinimized ? 280 : size.width, 
              height: isMinimized ? "auto" : size.height,
              transform: isMinimized ? "translate(0px, 0px)" : `translate(${position.x}px, ${position.y}px)`
            }}
          >
            {/* --- CUSTOM ALERT OVERLAY --- */}
            {showCloseAlert && (
              <div 
                className="absolute inset-0 z-[10000] flex items-center justify-center rounded-lg p-4 bg-black/5"
                onClick={handleOverlayClick}
              >
                <div 
                    className={cn(
                        "bg-white border shadow-lg p-6 rounded-md max-w-sm text-center",
                        isShaking && "animate-shake"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="font-semibold text-lg mb-2">Attention</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?
                    </p>
                    <div className="flex justify-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => setShowCloseAlert(false)}>Annuler</Button>
                        <Button variant="destructive" size="sm" onClick={confirmClose}>Fermer</Button>
                    </div>
                </div>
                <style>{`
                  @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                  }
                  .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                  }
                `}</style>
              </div>
            )}

            <div className="absolute right-3 top-3 z-50 flex gap-1">
              {!isMinimized && (
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 opacity-60 hover:opacity-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                  title="Réduire"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              )}
              <button 
                onClick={() => handleOpenChange(false)}
                onMouseDown={(e) => e.stopPropagation()} 
                className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* HEADER */}
            <div 
              onMouseDown={handleDragStart}
              className={cn(
                "flex-none p-4 select-none flex items-center gap-2",
                !isMinimized && "cursor-move",
                isMinimized && "py-3 px-3 border-b-0"
              )}
            >
              {isMinimized && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
              <div className="pr-12 truncate font-semibold text-sm">
                {isMinimized ? "Bon de réception (En cours...)" : "Créer un bon de réception"}
              </div>
            </div>

            {!isMinimized && (
               <div className="px-6 pb-4 border-b -mt-2 text-muted-foreground text-sm">
                  Remplissez les informations ci-dessous.
               </div>
            )}

            <div className={cn("flex flex-col flex-1 min-h-0", isMinimized && "hidden")}>
              <DialogTitle className="sr-only">Créer un bon de réception</DialogTitle>
              
              <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-6 pt-10 pb-40">
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  {/* --- TOP ZONES LAYOUT --- */}
                  <div className="flex flex-col gap-6">
                     {/* ROW 1 */}
                     <div className={cn("flex w-full gap-6", isMobile && "flex-col")}>
                         {/* ZONE 1: Information */}
                         <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "w-full" : "w-[40%]")}>
                            <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Informations pièce</h3>
                            <div className="space-y-4 pt-2">
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                  <Label className={isMobile ? "text-left" : "text-right"}>Numéro</Label>
                                  <Input value="BR-0001" className="w-full min-w-0" readOnly />
                               </div>
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                  <Label className={isMobile ? "text-left" : "text-right"}>Date de la pièce</Label>
                                  <DatePickerField selected={date} onSelect={setDate} placeholder="Sélectionner une date" />
                               </div>
                            </div>
                         </div>
                         {/* ZONE 2: Fournisseur */}
                         <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "w-full" : "w-[60%]")}>
                            <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                             <div className="space-y-4 pt-2">
                                <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                   <Label className={isMobile ? "text-left" : "text-right"}>Fournisseur</Label>
                                   <Select value={supplierId} onValueChange={handleSupplierChange}>
                                      <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                        <SelectValue placeholder="Sélectionnez un fournisseur" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="create_new_supplier" className="text-blue-600 font-semibold bg-blue-50">
                                           <div className="flex items-center gap-2"><PlusCircle className="h-4 w-4" /><span>Créer un nouveau fournisseur</span></div>
                                        </SelectItem>
                                         {availableSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                </div>
                             </div>
                         </div>
                     </div>

                     {/* ROW 2 */}
                     <div className={cn("flex w-full gap-6", isMobile && "flex-col")}>
                         {/* ZONE 3: Règlement */}
                         <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "w-full" : "w-[40%]")}>
                            <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Règlement</h3>
                            <div className="space-y-4 pt-2">
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                  <Label className={isMobile ? "text-left" : "text-right"}>Mode de paiement</Label>
                                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                      <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                        <SelectValue placeholder="Espèces" />
                                      </SelectTrigger>
                                      <SelectContent><SelectItem value="cash">Espèces</SelectItem></SelectContent>
                                   </Select>
                               </div>
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                  <Label className={isMobile ? "text-left" : "text-right"}>Date d'échéance</Label>
                                  <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="Date d'échéance" />
                               </div>
                            </div>
                         </div>
                         {/* ZONE 4: Détails */}
                         <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "w-full" : "w-[60%]")}>
                            <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                            <div className="space-y-4 pt-2">
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                  <Label className={isMobile ? "text-left" : "text-right"}>Représentant</Label>
                                  <Select value={representativeId} onValueChange={handleRepresentativeChange}>
                                      <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                        <SelectValue placeholder="Sélectionnez un représentant" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="create_new_rep" className="text-blue-600 font-semibold bg-blue-50">
                                           <div className="flex items-center gap-2"><PlusCircle className="h-4 w-4" /><span>Créer un nouveau représentant</span></div>
                                        </SelectItem>
                                         {availableRepresentatives.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                      </SelectContent>
                                   </Select>
                               </div>
                               <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                  <Label className={isMobile ? "text-left" : "text-right"}>Référence</Label>
                                  <Input placeholder="Référence" className="w-full min-w-0" value={reference} onChange={(e) => setReference(e.target.value)} />
                               </div>
                            </div>
                         </div>
                     </div>
                  </div>

                  {/* ITEMS TABLE - FIX: Replaced Shadcn Table with HTML Table to remove Overflow Clipping */}
                  {/* FIX: Increased min-height to 500px for better spacing */}
                  <div className="border border-blue-800 rounded-md min-h-[500px] overflow-visible">
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
                        {items.map((item) => (
                            <tr key={item.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                              <td className="p-4 align-middle">
                                <ArticleSelector 
                                    value={item.articleId}
                                    onChange={(val) => handleArticleChange(item.id, val)}
                                    articles={availableArticles}
                                    onOpenAdvanced={() => openArticleSearch(item.id)}
                                    onCreateNew={() => handleCreateNewArticle(item.id)}
                                    // Add autoFocus prop to fix the "Auto Highlight" regression
                                    autoFocus={item.id === newRowId}
                                />
                              </td>
                              <td className="p-4 align-middle"><Input type="number" value={item.qty} min={1} onChange={(e) => handleLineChange(item.id, 'qty', Number(e.target.value))} className="min-w-[60px]" /></td>
                              <td className="p-4 align-middle"><Input type="number" value={item.price} min={0} onChange={(e) => handleLineChange(item.id, 'price', Number(e.target.value))} className="min-w-[60px] bg-slate-50" /></td>
                              <td className="p-4 align-middle"><Input type="number" value={item.tva} readOnly className="min-w-[60px] bg-slate-50" /></td>
                              <td className="p-4 align-middle text-right font-medium">{(item.price * item.qty).toFixed(2)} €</td>
                              <td className="p-4 align-middle flex items-center justify-end gap-1">
                                 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => insertItemAfter(item.id)} title="Insérer">
                                   <PlusCircle className="h-4 w-4" />
                                 </Button>
                                 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.id)} title="Supprimer">
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                              </td>
                            </tr>
                        ))}
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                          <td colSpan={6} className="p-4 align-middle">
                             <Button type="button" variant="outline" className="w-full border-dashed text-muted-foreground" onClick={addItem}>+ Ajouter une ligne</Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </form>
              </div>

              {/* FOOTER */}
              <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg">
                <div className="space-y-2 text-right mb-4">
                    <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>{totalHT.toFixed(2)} €</span></div>
                    <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>{totalTVA.toFixed(2)} €</span></div>
                    <div className="flex justify-end gap-4 font-bold text-lg"><span>Total TTC:</span> <span>{totalTTC.toFixed(2)} €</span></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
                  <Button className="bg-slate-900 text-white">Créer</Button>
                </DialogFooter>
              </div>
            </div>

            {!isMinimized && (
              <>
                <div onMouseDown={handleResize('right')} className="absolute -right-3 top-0 bottom-0 w-3 cursor-ew-resize z-50 transition-colors" />
                <div onMouseDown={handleResize('bottom')} className="absolute -bottom-3 left-0 right-0 h-3 cursor-ns-resize z-50 transition-colors" />
                <div onMouseDown={handleResize('corner')} className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize z-50 rounded-tl-md" />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* RENDER THESE AFTER THE MAIN DIALOG TO FIX Z-INDEX STACKING */}
      <ArticleDialog 
        isOpen={isCreateArticleOpen}
        onOpenChange={setIsCreateArticleOpen}
        onArticleCreated={handleArticleCreated}
        lastArticleCodeNumber={lastArticleCodeNumber}
        isChild={true} 
      />

      <RepresentativeDialog
        isOpen={isCreateRepOpen}
        onOpenChange={setIsCreateRepOpen}
        onRepresentativeCreated={handleRepresentativeCreated}
      />

      <SupplierDialog
        isOpen={isCreateSupplierOpen}
        onOpenChange={setIsCreateSupplierOpen}
        onSupplierCreated={handleSupplierCreated}
        lastSupplierCodeNumber={lastSupplierCodeNumber}
        suppliers={availableSuppliers}
      />

      <SupplierSearchDialog 
        isOpen={isSupplierSearchOpen}
        onOpenChange={setIsSupplierSearchOpen}
        onSelect={handleSupplierSearchSelect}
        suppliers={availableSuppliers}
      />

      <ArticleSearchDialog 
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleArticleSearchSelect}
        articles={availableArticles}
      />
    </>
  )
}
