import React, { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Search, PlusCircle, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Supplier as SupplierType, Product as ArticleType, Representative as RepresentativeType } from "@/lib/types"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isBefore, startOfDay } from "date-fns"
import { fr } from "date-fns/locale"

// Types locaux pour assurer la compatibilité
type Article = ArticleType;
type Supplier = SupplierType;
type Representative = RepresentativeType;

// --- COMPONENT: AUTOCOMPLETE REPRESENTATIVE SELECTOR ---
export const RepresentativeSelector = ({ 
    value, 
    onChange, 
    representatives, 
    onOpenAdvanced,
    onCreateNew,
    hasError,
    disabled = false
}: { 
    value: string, 
    onChange: (id: string) => void, 
    representatives: Representative[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    hasError?: boolean,
    disabled?: boolean
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
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        placeholder="Sélectionnez un représentant..."
                        value={inputValue}
                        autoComplete="off" 
                        disabled={disabled}
                        onFocus={() => {
                            if (skipOpenRef.current || disabled) return;
                            setOpen(true)
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (skipOpenRef.current || disabled) return;
                            setOpen(true); 
                        }}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setOpen(true)
                        }}
                        className={cn("w-full pr-10", hasError && "border-red-500 focus-visible:ring-red-500")} 
                    />
                    {!disabled && (
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
                    )}
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
export const SupplierSelector = ({ 
    value, 
    onChange, 
    suppliers, 
    onOpenAdvanced,
    onCreateNew,
    hasError,
    disabled = false
}: { 
    value: string, 
    onChange: (id: string) => void, 
    suppliers: Supplier[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    hasError?: boolean,
    disabled?: boolean
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
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        placeholder="Sélectionnez un fournisseur..."
                        value={inputValue}
                        autoComplete="off" 
                        disabled={disabled}
                        onFocus={() => {
                            if (skipOpenRef.current || disabled) return;
                            setOpen(true)
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (skipOpenRef.current || disabled) return;
                            setOpen(true); 
                        }}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setOpen(true)
                        }}
                        className={cn("w-full pr-10", hasError && "border-red-500 focus-visible:ring-red-500")} 
                    />
                    {!disabled && (
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
                    )}
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
export const ArticleSelector = ({ 
    value, 
    onChange, 
    articles, 
    onOpenAdvanced,
    onCreateNew,
    autoFocus = false,
    hasError,
    disabled = false
}: { 
    value: string, 
    onChange: (id: string) => void, 
    articles: Article[],
    onOpenAdvanced: () => void,
    onCreateNew: () => void,
    autoFocus?: boolean,
    hasError?: boolean,
    disabled?: boolean
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const skipOpenRef = useRef(false)

    useEffect(() => {
        if (autoFocus && inputRef.current && !disabled) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [autoFocus, disabled]);

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
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        ref={inputRef}
                        placeholder="Saisir un article..."
                        value={inputValue}
                        autoComplete="off" 
                        disabled={disabled}
                        onFocus={() => {
                            if (skipOpenRef.current || disabled) return;
                            setOpen(true)
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (skipOpenRef.current || disabled) return;
                            setOpen(true); 
                        }}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setOpen(true)
                        }}
                        className={cn("w-full pr-10", hasError && "border-red-500 focus-visible:ring-red-500")} 
                    />
                    {!disabled && (
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
                    )}
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

// --- REPRESENTATIVE SEARCH DIALOG ---
export const RepresentativeSearchDialog = ({ 
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
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
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

// --- SUPPLIER SEARCH DIALOG ---
export const SupplierSearchDialog = ({ 
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
      (s.code && s.code.toLowerCase().includes(lowerTerm))
    );
  }, [searchTerm, suppliers]);

  useEffect(() => {
    if (isOpen) setSearchTerm("")
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
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

// --- ARTICLE SEARCH DIALOG ---
export const ArticleSearchDialog = ({ 
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
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
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
export const SimpleCalendar = ({ selected, onSelect, onClose, minDate }: { selected: Date | undefined, onSelect: (d: Date) => void, onClose: () => void, minDate?: Date }) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())
  const [manualInput, setManualInput] = useState(selected ? format(selected, "dd/MM/yyyy") : "")
  const [isInputInvalid, setIsInputInvalid] = useState(false)
  const [calendarDateWarning, setCalendarDateWarning] = useState<string | null>(null)
  const localInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected && document.activeElement !== localInputRef.current) {
      setManualInput(format(selected, "dd/MM/yyyy"))
      setCurrentMonth(selected)
      setIsInputInvalid(false)
    }
  }, [selected])

  const tryUpdateDate = (val: string) => {
    const match = val.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
    if (match) {
        const day = parseInt(match[1], 10)
        const month = parseInt(match[2], 10) - 1 
        const year = parseInt(match[3], 10)
        const d = new Date(year, month, day)
        if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
            if (minDate && isBefore(d, startOfDay(minDate))) {
                setCalendarDateWarning(`Ne peut pas être avant le ${format(minDate, "dd/MM/yyyy")}.`)
                return false
            }
            setCalendarDateWarning(null)
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
    
    const parts = val.split(/[\/\-\.]/)
    const dStr = parts[0]
    const mStr = parts[1]
    const yStr = parts[2]

    let invalid = false
    if (dStr && parseInt(dStr, 10) > 31) invalid = true
    if (mStr && parseInt(mStr, 10) > 12) invalid = true
    if (!invalid && val.length === 10) {
        const isValidDate = tryUpdateDate(val)
        if (!invalid && !isValidDate) invalid = true
    }
    setIsInputInvalid(invalid)
    if (val.length < 10) setCalendarDateWarning(null)
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
    if (minDate && isBefore(today, startOfDay(minDate))) return
    setCalendarDateWarning(null)
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
           const isBeforeMinDate = minDate && isBefore(d, startOfDay(minDate))
           return (
             <button
               key={i}
               disabled={isBeforeMinDate}
               onClick={(e) => { 
                  e.preventDefault(); 
                  setCalendarDateWarning(null);
                  onSelect(d); 
                  setIsInputInvalid(false);
               }}
               className={cn(
                 "h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors",
                 (!isCurrentMonth || isBeforeMinDate) && "text-gray-300",
                 isCurrentMonth && !isBeforeMinDate && "text-gray-700 hover:bg-gray-100",
                 isSelected && "bg-slate-900 text-white hover:bg-slate-800",
                 isToday && !isSelected && "border border-slate-400 font-semibold",
                 isBeforeMinDate && "opacity-40 pointer-events-none"
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
                "h-8 text-sm px-3 py-1.5 rounded-md flex-1 text-center font-medium bg-slate-50 transition-colors",
                "outline-none focus:outline-none focus-visible:outline-none",
                "ring-0 focus:ring-0 focus-visible:ring-0",
                "ring-offset-0 focus:ring-offset-0 focus-visible:ring-offset-0",
                "shadow-none focus:shadow-none focus-visible:shadow-none",
                "border border-slate-200 focus:border-blue-500",
                isInputInvalid && "border-red-500 focus:border-red-500 text-red-600"
            )}
         />
         <Button size="sm" variant="outline" className="h-8 text-xs font-medium px-2" onClick={(e) => { e.preventDefault(); handleToday() }} disabled={minDate && isBefore(new Date(), startOfDay(minDate))}>Aujourd'hui</Button>
         <Button 
            size="sm" 
            className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3" 
            onClick={(e) => { e.preventDefault(); onClose() }}
            disabled={isInputInvalid}
         >
            OK
         </Button>
      </div>
      {calendarDateWarning && <p className="text-xs text-red-600 mt-1 text-center">{calendarDateWarning}</p>}
    </div>
  )
}

export const DatePickerField = ({ selected, onSelect, placeholder, disabled = false, minDate }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [dateWarning, setDateWarning] = useState<string | null>(null)
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
            if (minDate && isBefore(d, startOfDay(minDate))) {
                setDateWarning(`Ne peut pas être avant le ${format(minDate, "dd/MM/yyyy")}.`);
                setInputValue(selected ? format(selected, "dd/MM/yyyy") : "");
                return false;
            }
            setDateWarning(null)
            onSelect(d)
            setInputValue(format(d, "dd/MM/yyyy"))
            return true
        }
    }
    return false
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setDateWarning(null)
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

  const handleCalendarSelect = (d: Date) => {
    setDateWarning(null)
    onSelect(d)
  }

  return (
    <div className="relative w-full">
        <div className="relative w-full">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder || "JJ/MM/AAAA"}
              className="w-full pr-10"
            />
            <Popover open={isOpen && !disabled} onOpenChange={setIsOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button 
                    type="button"
                    variant="ghost" 
                    size="icon"
                    disabled={disabled}
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-blue-600 rounded-l-none"
                    tabIndex={-1} 
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="bg-white rounded-md border shadow-md relative z-[10000]">
                    <SimpleCalendar selected={selected} onSelect={handleCalendarSelect} onClose={() => setIsOpen(false)} minDate={minDate} />
                </div>
              </PopoverContent>
            </Popover>
        </div>
        {dateWarning && (
          <p className="text-xs text-red-600 mt-1">{dateWarning}</p>
        )}
    </div>
  )
}

