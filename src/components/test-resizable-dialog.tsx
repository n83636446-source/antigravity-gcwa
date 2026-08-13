import React, { useState, useEffect, useMemo, useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogPortal } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight, X, Minus, PlusCircle, Search, Merge, Loader2, AlertTriangle } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

// --- FIREBASE IMPORTS ---
import { collection, getDocs } from "firebase/firestore"
import { useFirestore } from "@/firebase" 
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates" 
import type { PurchaseReceipt } from "@/lib/types" 
import { useToast } from "@/hooks/use-toast" 

import { ArticleDialog } from "@/components/article-dialog"
import { RepresentativeDialog } from "@/components/representative-dialog"
import { SupplierDialog } from "@/components/supplier-dialog"
import { useSidebar } from "@/components/ui/sidebar"

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

// --- COMPONENT: AUTOCOMPLETE REPRESENTATIVE SELECTOR ---
const RepresentativeSelector = ({ 
    value, 
    onChange, 
    representatives, 
    onOpenAdvanced,
    onCreateNew,
    hasError 
}: { 
    value: string, 
    onChange: (id: string) => void, 
    representatives: Representative[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    hasError?: boolean
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const skipOpenRef = useRef(false)

    useEffect(() => {
        const selected = representatives.find(r => r.id === value)
        if (selected) {
            setInputValue(selected.name)
        } else if (!value) {
            setInputValue("")
        }
    }, [value, representatives])

    const filteredReps = useMemo(() => {
        if (!inputValue) return representatives.slice(0, 10); 
        const lower = inputValue.toLowerCase()
        return representatives.filter(r => 
            r.name.toLowerCase().includes(lower) || 
            (r.code && r.code.toLowerCase().includes(lower))
        ).slice(0, 20); 
    }, [inputValue, representatives])

    const handleSelect = (rep: Representative) => {
        skipOpenRef.current = true;
        onChange(rep.id)
        setInputValue(rep.name)
        setOpen(false)
        setTimeout(() => { skipOpenRef.current = false; }, 150);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        placeholder="Sélectionnez un représentant..."
                        value={inputValue}
                        autoComplete="off" 
                        onFocus={() => {
                            if (skipOpenRef.current) return;
                            setOpen(true)
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (skipOpenRef.current) return;
                            setOpen(true); 
                        }}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setOpen(true)
                        }}
                        className={cn("w-full pr-10", hasError && "border-red-500 focus-visible:ring-red-500")} 
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
            </PopoverTrigger>
            
            <PopoverContent 
                className="w-[500px] p-0 overflow-hidden bg-white border border-slate-200 rounded-md shadow-2xl z-[99999] pointer-events-auto" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col">
                    <div 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => { 
                            e.stopPropagation();
                            skipOpenRef.current = true;
                            setOpen(false);
                            setTimeout(() => { skipOpenRef.current = false; }, 150);
                            onCreateNew(); 
                        }} 
                        className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors border-b"
                    >
                        <PlusCircle className="ml-1 h-4 w-4" />
                        Créer un nouveau représentant
                    </div>

                    <div className="grid grid-cols-[100px_1fr] items-center gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-slate-50 shrink-0">
                        <span className="text-left pl-2">Code</span>
                        <span className="text-left">Nom</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {filteredReps.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Aucun représentant trouvé.
                            </div>
                        )}

                        {filteredReps.map((rep) => (
                            <div
                                key={rep.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(rep);
                                }}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 transition-colors"
                            >
                                <div className="grid grid-cols-[100px_1fr] items-center gap-4 w-full">
                                    <span className="text-left font-mono text-xs text-muted-foreground pl-2">{rep.code || "-"}</span>
                                    <span className="text-left truncate font-medium">{rep.name}</span>
                                </div>
                            </div>
                        ))}

                        <div className="h-px bg-slate-100 my-1" />

                        <div 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { 
                                e.stopPropagation();
                                setTimeout(() => setOpen(false), 0);
                                onOpenAdvanced();
                            }} 
                            className="flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold text-blue-600 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <Search className="h-4 w-4" />
                            Ouvrir la liste complète...
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// --- COMPONENT: AUTOCOMPLETE SUPPLIER SELECTOR ---
const SupplierSelector = ({ 
    value, 
    onChange, 
    suppliers, 
    onOpenAdvanced,
    onCreateNew,
    hasError 
}: { 
    value: string, 
    onChange: (id: string) => void, 
    suppliers: Supplier[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    hasError?: boolean
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const skipOpenRef = useRef(false)

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
        skipOpenRef.current = true;
        onChange(supplier.id)
        setInputValue(supplier.name)
        setOpen(false)
        setTimeout(() => { skipOpenRef.current = false; }, 150);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        placeholder="Sélectionnez un fournisseur..."
                        value={inputValue}
                        autoComplete="off" 
                        onFocus={() => {
                            if (skipOpenRef.current) return;
                            setOpen(true)
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (skipOpenRef.current) return;
                            setOpen(true); 
                        }}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setOpen(true)
                        }}
                        className={cn("w-full pr-10", hasError && "border-red-500 focus-visible:ring-red-500")} 
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
            </PopoverTrigger>

            <PopoverContent 
                className="w-[500px] p-0 overflow-hidden bg-white border border-slate-200 rounded-md shadow-2xl z-[99999] pointer-events-auto" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col">
                    <div 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => { 
                            e.stopPropagation();
                            skipOpenRef.current = true;
                            setOpen(false);
                            setTimeout(() => { skipOpenRef.current = false; }, 150);
                            onCreateNew(); 
                        }} 
                        className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors border-b"
                    >
                        <PlusCircle className="ml-1 h-4 w-4" />
                        Créer un nouveau fournisseur
                    </div>

                    <div className="grid grid-cols-[100px_1fr] items-center gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-slate-50 shrink-0">
                        <span className="text-left pl-2">Code</span>
                        <span className="text-left">Nom</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {filteredSuppliers.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Aucun fournisseur trouvé.
                            </div>
                        )}

                        {filteredSuppliers.map((supplier) => (
                            <div
                                key={supplier.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(supplier);
                                }}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 transition-colors"
                            >
                                <div className="grid grid-cols-[100px_1fr] items-center gap-4 w-full">
                                    <span className="text-left font-mono text-xs text-muted-foreground pl-2">{supplier.code}</span>
                                    <span className="text-left truncate font-medium">{supplier.name}</span>
                                </div>
                            </div>
                        ))}

                        <div className="h-px bg-slate-100 my-1" />

                        <div 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { 
                                e.stopPropagation();
                                setTimeout(() => setOpen(false), 0);
                                onOpenAdvanced();
                            }} 
                            className="flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold text-blue-600 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <Search className="h-4 w-4" />
                            Ouvrir la liste complète...
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// --- COMPONENT: AUTOCOMPLETE ARTICLE SELECTOR ---
const ArticleSelector = ({ 
    value, 
    onChange, 
    articles, 
    onOpenAdvanced,
    onCreateNew,
    autoFocus = false,
    hasError 
}: { 
    value: string, 
    onChange: (id: string) => void, 
    articles: Article[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    autoFocus?: boolean,
    hasError?: boolean
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const skipOpenRef = useRef(false)

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
            (a.code && a.code.toLowerCase().includes(lower))
        ).slice(0, 20); 
    }, [inputValue, articles])

    const handleSelect = (article: Article) => {
        skipOpenRef.current = true;
        onChange(article.id)
        setInputValue(article.name)
        setOpen(false)
        setTimeout(() => { skipOpenRef.current = false; }, 150);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        ref={inputRef}
                        placeholder="Saisir un article..."
                        value={inputValue}
                        autoComplete="off" 
                        onFocus={() => {
                            if (skipOpenRef.current) return;
                            setOpen(true)
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (skipOpenRef.current) return;
                            setOpen(true); 
                        }}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setOpen(true)
                        }}
                        className={cn("w-full pr-10", hasError && "border-red-500 focus-visible:ring-red-500")} 
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
            </PopoverTrigger>

            <PopoverContent 
                className="w-[600px] p-0 overflow-hidden bg-white border border-slate-200 rounded-md shadow-2xl z-[99999] pointer-events-auto" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col">
                    <div 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            skipOpenRef.current = true;
                            setOpen(false);
                            setTimeout(() => { skipOpenRef.current = false; }, 150);
                            onCreateNew(); 
                        }} 
                        className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors border-b"
                    >
                        <PlusCircle className="ml-1 h-4 w-4" />
                        Créer un nouvel article
                    </div>

                    <div className="grid grid-cols-[100px_300px_100px] items-center gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-slate-50 shrink-0">
                        <span className="text-left pl-2">Code</span>
                        <span className="text-left">Désignation</span>
                        <span className="text-right pr-2">Stock</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {filteredArticles.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Aucun article trouvé.
                            </div>
                        )}

                        {filteredArticles.map((article) => (
                            <div
                                key={article.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
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
                            </div>
                        ))}

                        <div className="h-px bg-slate-100 my-1" />

                        <div 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                skipOpenRef.current = true;
                                setOpen(false);
                                setTimeout(() => { skipOpenRef.current = false; }, 150);
                                onOpenAdvanced();
                            }} 
                            className="flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold text-blue-600 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                        >
                            <Search className="h-4 w-4" />
                            Ouvrir la liste complète...
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// --- REST OF THE FILE: DIALOGS & FORM ---

const RepresentativeSearchDialog = ({ 
  isOpen, 
  onOpenChange, 
  onSelect, 
  representatives,
  onCreateNew 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (rep: Representative) => void;
  representatives: Representative[];
  onCreateNew?: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredReps = useMemo(() => {
    if (!searchTerm) return representatives;
    const lowerTerm = searchTerm.toLowerCase();
    return representatives.filter(r => 
      r.name.toLowerCase().includes(lowerTerm) || 
      (r.code && r.code.toLowerCase().includes(lowerTerm))
    );
  }, [searchTerm, representatives]);

  useEffect(() => {
    if (isOpen) setSearchTerm("")
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher un représentant</DialogTitle>
        <div className="p-4 border-b">
            <h2 className="text-lg font-semibold mb-2">Rechercher un représentant</h2>
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
        
        <div 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors border-b"
        >
            <PlusCircle className="h-4 w-4" />
            Créer un nouveau représentant
        </div>

        <div className="flex-1 overflow-auto p-0">
            <table className="w-full caption-bottom text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm [&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">Code</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nom</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {filteredReps.length === 0 ? (
                        <tr className="border-b transition-colors">
                            <td colSpan={3} className="p-4 align-middle text-center py-8 text-muted-foreground">Aucun représentant trouvé.</td>
                        </tr>
                    ) : (
                        filteredReps.map(rep => (
                            <tr key={rep.id} className="border-b transition-colors hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(rep)}>
                                <td className="p-4 align-middle font-mono text-xs">{rep.code || "-"}</td>
                                <td className="p-4 align-middle font-medium">{rep.name}</td>
                                <td className="p-4 align-middle text-muted-foreground">{rep.email || "-"}</td>
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

const SupplierSearchDialog = ({ 
  isOpen, 
  onOpenChange, 
  onSelect, 
  suppliers,
  onCreateNew 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (supplier: Supplier) => void;
  suppliers: Supplier[];
  onCreateNew?: () => void;
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

        <div 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors border-b"
        >
            <PlusCircle className="h-4 w-4" />
            Créer un nouveau fournisseur
        </div>

        <div className="flex-1 overflow-auto p-0">
            <table className="w-full caption-bottom text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm [&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">Code</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nom</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Contact</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {filteredSuppliers.length === 0 ? (
                        <tr className="border-b transition-colors">
                            <td colSpan={4} className="p-4 align-middle text-center py-8 text-muted-foreground">Aucun fournisseur trouvé.</td>
                        </tr>
                    ) : (
                        filteredSuppliers.map(supplier => (
                            <tr key={supplier.id} className="border-b transition-colors hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(supplier)}>
                                <td className="p-4 align-middle font-mono text-xs">{supplier.code}</td>
                                <td className="p-4 align-middle font-medium">{supplier.name}</td>
                                <td className="p-4 align-middle text-muted-foreground">{supplier.contactName || "-"}</td>
                                <td className="p-4 align-middle text-muted-foreground">{supplier.contactEmail || "-"}</td>
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

const ArticleSearchDialog = ({ 
  isOpen, 
  onOpenChange, 
  onSelect, 
  articles,
  onCreateNew 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (article: Article) => void;
  articles: Article[];
  onCreateNew?: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredArticles = useMemo(() => {
    if (!searchTerm) return articles;
    const lowerTerm = searchTerm.toLowerCase();
    return articles.filter(a => 
      a.name.toLowerCase().includes(lowerTerm) || 
      (a.code && a.code.toLowerCase().includes(lowerTerm))
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

        <div 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors border-b"
        >
            <PlusCircle className="h-4 w-4" />
            Créer un nouvel article
        </div>

        <div className="flex-1 overflow-auto p-0">
            <table className="w-full caption-bottom text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm [&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">Code</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Désignation</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px] text-right">Prix</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[80px] text-right">Stock</th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {filteredArticles.length === 0 ? (
                        <tr className="border-b transition-colors">
                            <td colSpan={4} className="p-4 align-middle text-center py-8 text-muted-foreground">Aucun article trouvé.</td>
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

// --- DATE PICKER FIELD ---
const SimpleCalendar = ({ selected, onSelect, onClose }: { selected: Date | undefined, onSelect: (d: Date) => void, onClose: () => void }) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())
  const [manualInput, setManualInput] = useState(selected ? format(selected, "dd/MM/yyyy") : "")
  const [isInputInvalid, setIsInputInvalid] = useState(false)
  const localInputRef = useRef<HTMLInputElement>(null)

  // Sync internal state with external 'selected' prop, 
  // but ONLY if the user isn't currently typing in the field to avoid focus/cursor issues.
  useEffect(() => {
    if (selected && document.activeElement !== localInputRef.current) {
      setManualInput(format(selected, "dd/MM/yyyy"))
      setCurrentMonth(selected)
      setIsInputInvalid(false)
    }
  }, [selected])

  const tryUpdateDate = (val: string) => {
    // Attempt to parse JJ/MM/AAAA format
    const match = val.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
    if (match) {
        const day = parseInt(match[1], 10)
        const month = parseInt(match[2], 10) - 1 
        const year = parseInt(match[3], 10)
        const d = new Date(year, month, day)
        if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
            onSelect(d)
            setCurrentMonth(d)
            return true
        }
    }
    return false
  }

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setManualInput(val)
    
    // VALIDATION CHECK
    const parts = val.split(/[\/\-\.]/)
    const dStr = parts[0]
    const mStr = parts[1]
    const yStr = parts[2]

    let invalid = false

    // 1. Basic out-of-bounds check for day and month
    if (dStr && parseInt(dStr, 10) > 31) invalid = true
    if (mStr && parseInt(mStr, 10) > 12) invalid = true
    
    // 2. Full string check (for things like Feb 30th)
    if (!invalid && val.length === 10) {
        const isValidDate = tryUpdateDate(val)
        if (!isValidDate) invalid = true
    }

    setIsInputInvalid(invalid)
  }

  const handleManualBlur = () => {
    const isValid = tryUpdateDate(manualInput)
    if (!isValid) {
        if (selected) {
           setManualInput(format(selected, "dd/MM/yyyy"))
        } else {
           setManualInput("")
        }
        setIsInputInvalid(false)
    }
  }

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        const isValid = tryUpdateDate(manualInput)
        if (isValid) {
            setIsInputInvalid(false)
            localInputRef.current?.blur()
        } else {
            setIsInputInvalid(true)
        }
    }
  }

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  
  const handleToday = () => {
    const today = new Date()
    onSelect(today)
    setCurrentMonth(today)
    setIsInputInvalid(false)
    onClose() 
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
               onClick={(e) => { 
                  e.preventDefault(); 
                  onSelect(d); 
                  setIsInputInvalid(false);
               }}
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
         <Input 
            ref={localInputRef}
            value={manualInput} 
            onChange={handleManualInputChange}
            onBlur={handleManualBlur}
            onKeyDown={handleManualKeyDown}
            placeholder="JJ/MM/AAAA"
            className={cn(
                "h-8 text-sm px-3 py-1.5 rounded-md flex-1 text-center font-medium border bg-slate-50 focus-visible:ring-blue-500",
                isInputInvalid && "border-red-500 focus-visible:ring-red-500 text-red-600"
            )}
         />
         <Button size="sm" variant="outline" className="h-8 text-xs font-medium px-2" onClick={(e) => { e.preventDefault(); handleToday() }}>Aujourd'hui</Button>
         <Button 
            size="sm" 
            className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3" 
            onClick={(e) => { e.preventDefault(); onClose() }}
            disabled={isInputInvalid}
         >
            OK
         </Button>
      </div>
    </div>
  )
}

const DatePickerField = ({ selected, onSelect, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
        if (selected) {
          setInputValue(format(selected, "dd/MM/yyyy"))
        } else {
          setInputValue("")
        }
    }
  }, [selected])

  const processDate = (val: string) => {
    const match = val.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
    if (match) {
        const day = parseInt(match[1], 10)
        const month = parseInt(match[2], 10) - 1 
        const year = parseInt(match[3], 10)
        const d = new Date(year, month, day)
        if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
            onSelect(d)
            setInputValue(format(d, "dd/MM/yyyy"))
            return true
        }
    }
    return false
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleBlur = () => {
    const isValid = processDate(inputValue)
    if (!isValid) {
        if (selected) {
           setInputValue(format(selected, "dd/MM/yyyy"))
        } else {
           setInputValue("")
        }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        processDate(inputValue)
        inputRef.current?.blur()
    }
  }

  return (
    <div className="relative w-full">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "JJ/MM/AAAA"}
          className="w-full pr-10"
        />
        <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button 
                type="button"
                variant="ghost" 
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600 rounded-l-none"
                tabIndex={-1} 
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="bg-white rounded-md border shadow-md relative z-[10000]">
                <SimpleCalendar selected={selected} onSelect={onSelect} onClose={() => setIsOpen(false)} />
            </div>
          </PopoverContent>
        </Popover>
    </div>
  )
}

export function TestResizableDialog() {
  const [open, setOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Get Sidebar state for exact layout synchronization
  const { state, isMobile } = useSidebar();
  
  // Logical offset for JavaScript calculations
  const dockOffset = isMobile ? 0 : (state === 'expanded' ? 256 : 48);
  
  const dialogRef = useRef<HTMLDivElement>(null)
  
  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingReceipts, setExistingReceipts] = useState<PurchaseReceipt[]>([])
  
  const [receiptNumber, setReceiptNumber] = useState("BR0001")
  const [remarks, setRemarks] = useState("") 
  const [formErrors, setFormErrors] = useState<{
      supplier?: boolean;
      items?: boolean;
      receiptNumber?: boolean;
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

  const db = useFirestore()

  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false)
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false)
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  const [isHoveringDock, setIsHoveringDock] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const calculateNextNumber = (receipts: PurchaseReceipt[]) => {
    if (!receipts || receipts.length === 0) return "BR0001";
    const maxId = receipts.reduce((max, r) => {
        const num = parseInt(r.receiptNumber.replace("BR", "") || "0", 10);
        return num > max ? num : max;
    }, 0);
    return `BR${(maxId + 1).toString().padStart(4, '0')}`;
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
    setIsShaking(false); 
    setFormErrors({}); 
    setReceiptNumber(calculateNextNumber(existingReceipts));
    setIsHoveringDock(false);
  }

  const isFormDirty = () => {
    if (receiptNumber !== calculateNextNumber(existingReceipts)) return true;
    if (!isSameDay(date, new Date())) return true;
    if (!isSameDay(dueDate, new Date())) return true;
    if (supplierId !== "" || representativeId !== "" || reference !== "" || remarks !== "") return true;
    if (items.length > 1) return true;
    if (items.length === 1 && items[0].articleId !== "") return true;
    return false;
  }

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

  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      try {
        const [articlesSnap, suppliersSnap, repsSnap, receiptsSnap] = await Promise.all([
            getDocs(collection(db, "products")),
            getDocs(collection(db, "suppliers")),
            getDocs(collection(db, "representatives")),
            getDocs(collection(db, "purchaseReceipts"))
        ])

        const articles = articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
        const suppliers = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[];
        const reps = repsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Representative[];
        const receipts = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PurchaseReceipt[];

        setAvailableArticles(deduplicate(articles));
        setAvailableSuppliers(deduplicate(suppliers));
        setAvailableRepresentatives(deduplicate(reps));
        setExistingReceipts(receipts);
        setReceiptNumber(calculateNextNumber(receipts));
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }
    if (open && db) fetchData()
  }, [open, db])

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

  const handleCreateReceipt = async () => {
    if (!db) return;
    const newErrors: typeof formErrors = {};
    let hasError = false;
    if (!supplierId) { newErrors.supplier = true; hasError = true; }
    if (!receiptNumber.trim()) { newErrors.receiptNumber = true; hasError = true; }
    const validItems = items.filter(i => i.articleId && i.qty > 0);
    if (validItems.length === 0) { newErrors.items = true; hasError = true; }
    if (hasError) {
        setFormErrors(newErrors);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
        playWarningSound(); 
        return;
    }
    setFormErrors({});
    setIsSubmitting(true);
    try {
        const receiptData: any = {
            receiptNumber: receiptNumber, 
            supplierId: supplierId,
            receiptDate: date instanceof Date ? date.toISOString() : new Date().toISOString(),
            items: validItems.map(i => ({
                productId: i.articleId,
                quantityReceived: i.qty,
                price: i.price,
                tvaRate: i.tva
            })),
            status: "Brouillon", 
            totalHT: totalHT,
            totalTTC: totalTTC,
            paymentMode: paymentMethod,
            dueDate: dueDate instanceof Date ? dueDate.toISOString() : new Date().toISOString(),
        };
        if (representativeId) receiptData.representativeId = representativeId;
        if (reference) receiptData.reference = reference;
        if (remarks) receiptData.remarks = remarks;
        const docRef = await addDocumentNonBlocking(collection(db, "purchaseReceipts"), receiptData);
        if (docRef) {
            toast({ title: "Succès", description: `Bon de réception ${receiptNumber} créé avec succès.` });
            setOpen(false);
            setTimeout(() => { resetForm(); setIsSubmitting(false); }, 300);
        }
    } catch (error) {
        console.error("Failed to save receipt", error);
        toast({ title: "Erreur", description: "Une erreur est survenue lors de l'enregistrement.", variant: "destructive" });
        setIsSubmitting(false);
    }
  }

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
        const newItems = [...prevItems]
        newItems.splice(index + 1, 0, newItem)
        return newItems
    })
    setNewRowId(newId) 
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

  const handleMerge = (originalId: string, duplicateId: string) => {
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
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 400)
      playWarningSound()
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
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.receiptNumber && "text-red-500")}>Numéro *</Label>
                          <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} className={cn("w-full min-w-0 font-mono", formErrors.receiptNumber && "border-red-500 focus-visible:ring-red-500")} />
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Date de la pièce</Label>
                          <DatePickerField selected={date} onSelect={setDate} placeholder="JJ/MM/AAAA" />
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                     <div className="space-y-4 pt-2">
                        <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                           <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.supplier && "text-red-500")}>Fournisseur *</Label>
                           <div className="w-full">
                               <SupplierSelector value={supplierId} onChange={handleSupplierChange} suppliers={availableSuppliers} onOpenAdvanced={() => setIsSupplierSearchOpen(true)} onCreateNew={() => setIsCreateSupplierOpen(true)} hasError={formErrors.supplier} />
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
                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                              <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                  <SelectValue placeholder="Espèces" />
                              </SelectTrigger>
                              <SelectContent><SelectItem value="cash">Espèces</SelectItem></SelectContent>
                           </Select>
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Date d'échéance</Label>
                          <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="JJ/MM/AAAA" />
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                    <div className="space-y-4 pt-2">
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Représentant</Label>
                          <RepresentativeSelector value={representativeId} onChange={handleRepresentativeChange} representatives={availableRepresentatives} onOpenAdvanced={() => setIsRepresentativeSearchOpen(true)} onCreateNew={() => setIsCreateRepOpen(true)} />
                        </div>
                       <div className="space-y-4 pt-2">
                          <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                             <Label className={isMobileSize ? "text-left" : "text-right"}>Référence</Label>
                             <Input placeholder="Référence" className="w-full min-w-0" value={reference} onChange={(e) => setReference(e.target.value)} />
                          </div>
                          <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                             <Label className={isMobileSize ? "text-left" : "text-right"}>Remarque</Label>
                             <Input placeholder="Remarque" className="w-full min-w-0" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                          </div>
                       </div>
                    </div>
                 </div>
             </div>
          </div>
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
                            <ArticleSelector value={item.articleId} onChange={(val: string) => handleArticleChange(item.id, val)} articles={availableArticles} onOpenAdvanced={() => openArticleSearch(item.id)} onCreateNew={() => handleCreateNewArticle(item.id)} autoFocus={item.id === newRowId} />
                            {originalItem && (
                                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mt-2 animate-in fade-in slide-in-from-top-1">
                                   <AlertTriangle className="h-3 w-3 shrink-0" />
                                   <span className="font-medium">Article déjà présent.</span>
                                   <Button size="sm" variant="outline" className="h-6 text-xs bg-white hover:bg-amber-100 border-amber-300 text-amber-800 ml-auto" onClick={() => handleMerge(originalItem.id, item.id)}><Merge className="mr-1 h-3 w-3" />Fusionner</Button>
                                </div>
                            )}
                          </td>
                          <td className="p-4 align-middle"><Input type="number" value={item.qty} min={1} onChange={(e) => handleLineChange(item.id, 'qty', Number(e.target.value))} className="min-w-[60px]" /></td>
                          <td className="p-4 align-middle"><Input type="number" value={item.price} min={0} onChange={(e) => handleLineChange(item.id, 'price', Number(e.target.value))} className="min-w-[60px] bg-slate-50" /></td>
                          <td className="p-4 align-middle"><Input type="number" value={item.tva} readOnly className="min-w-[60px] bg-slate-50" /></td>
                          <td className="p-4 align-middle text-right font-medium">{(item.price * item.qty).toFixed(2)} €</td>
                          <td className="p-4 align-middle flex items-center justify-end gap-1">
                             <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => insertItemAfter(item.id)} title="Insérer"><PlusCircle className="h-4 w-4" /></Button>
                             <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                    )
                })}
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
      <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg text-right">
        <div className="space-y-2 mb-4">
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>{totalHT.toFixed(2)} €</span></div>
            <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>{totalTVA.toFixed(2)} €</span></div>
            <div className="flex justify-end gap-4 font-bold text-lg text-blue-900"><span>TOTAL TTC:</span> <span>{totalTTC.toFixed(2)} €</span></div>
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
          <Button className="bg-slate-900 text-white" disabled={isSubmitting} onClick={handleCreateReceipt}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Créer"}
          </Button>
        </DialogFooter>
      </div>
    </div>
  );

  return (
    <>
      <Button variant="outline" onClick={handleMainButtonClick}>
        Open Test Dialog
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
        <DialogPortal>
          {/* 
            STRICT FLEXBOX SYNC WRAPPER
            We mirror the layout structure (Sidebar + Content) using a fixed flex container.
            The spacer matches the sidebar's width exactly, ensuring the content area 
            is 'pushed' synchronously during transitions.
          */}
          <div 
            className="fixed inset-0 z-40 flex pointer-events-none transition-all duration-300 ease-in-out"
          >
             {/* Layout Spacer: Mirrors the Sidebar width */}
             {!isMobile && (
                <div 
                    className="flex-none transition-all duration-300 ease-in-out" 
                    style={{ width: dockOffset }} 
                />
             )}

             {/* Right Main Window Anchor: All dialog elements are relative to this pushed area */}
             <div className="flex-1 relative pointer-events-none h-full w-full">
                
                {/* Backdrop - Strictly confined to the content area */}
                {open && !isMinimized && (
                    <div 
                        className="absolute inset-0 z-40 bg-black/80 pointer-events-auto transition-all duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                        onClick={(e) => { e.stopPropagation(); handleOverlayClick(); }}
                    />
                )}

                <DialogPrimitive.Content 
                    onInteractOutside={(e) => {
                        // Prevent automatic closing by Radix to keep control (especially when minimized)
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
                                className={cn("bg-white border shadow-lg p-6 rounded-md max-w-sm text-center", isShaking && "animate-shake")}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="font-semibold text-lg mb-2">Attention</h3>
                                <p className="text-sm text-muted-foreground mb-6">Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?</p>
                                <div className="flex justify-center gap-3">
                                    <Button variant="outline" size="sm" onClick={() => setShowCloseAlert(false)}>Annuler</Button>
                                    <Button variant="destructive" size="sm" onClick={confirmClose}>Fermer</Button>
                                </div>
                            </div>
                            <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } } .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }`}</style>
                            </div>
                        )}

                        {isMinimized && (
                            <div className={cn("absolute bottom-full left-1/2 -translate-x-1/2 pb-3 z-[10000] origin-bottom transition-all duration-300 ease-out", isHoveringDock ? "scale-100 opacity-100 pointer-events-auto" : "scale-0 opacity-0 pointer-events-none")}>
                            <div className="group bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden cursor-pointer relative" style={{ width: 1000 * 0.25, height: 800 * 0.25 }} onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}>
                                <button onClick={(e) => { e.stopPropagation(); handleOpenChange(false); setIsHoveringDock(false); }} className="absolute top-2 right-2 z-50 p-1.5 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 rounded-md transition-opacity duration-200 shadow-sm pointer-events-auto opacity-0 group-hover:opacity-100" title="Fermer"><X className="h-4 w-4" /></button>
                                <div className="pointer-events-none origin-top-left bg-white flex flex-col" style={{ width: 1000, height: 800, transform: 'scale(0.25)' }}>
                                    <div className="flex-none p-4 flex items-center gap-2 font-semibold text-sm">Créer un bon de réception</div>
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
                                <button onClick={() => handleOpenChange(false)} onMouseDown={(e) => e.stopPropagation()} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-colors cursor-pointer" title="Fermer"><X className="h-3.5 w-3.5" /></button>
                            </>
                            )}
                        </div>

                        <div className={cn("flex-none p-4 select-none flex items-center gap-2", !isMinimized && "cursor-default", isMinimized && "py-0 px-3 h-10")}>
                            {isMinimized && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                            <div className={cn("font-semibold text-sm", isMinimized ? "whitespace-nowrap pr-2" : "truncate pr-12")}>{isMinimized ? `Bon de réception - ${receiptNumber}` : "Créer un bon de réception"}</div>
                        </div>
                        {!isMinimized && (<div className="px-6 pb-4 border-b text-muted-foreground text-sm text-left">Remplissez les informations ci-dessous.</div>)}
                        <div className={cn("flex-col flex-1 min-h-0 transition-opacity duration-300", isMinimized ? "hidden" : "flex")}>
                            <DialogTitle className="sr-only">Créer un bon de réception</DialogTitle>
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
