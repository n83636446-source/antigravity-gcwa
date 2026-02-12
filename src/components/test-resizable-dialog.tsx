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

// --- SUB-COMPONENTS (DEFINED BEFORE USAGE) ---

// 1. Representative Search Dialog
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
        
        {/* NEW TOP ROW */}
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

// 2. Supplier Search Dialog
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

        {/* NEW TOP ROW */}
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

// 3. Article Search Dialog
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

        {/* NEW TOP ROW */}
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

// --- SELECTOR COMPONENTS ---

const RepresentativeSelector = ({ value, onChange, representatives, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = representatives.find((r:any) => r.id === value);
    return (
        <div className="flex gap-1">
            <div className={cn("flex-1 border rounded-md px-3 py-2 text-sm", hasError && "border-red-500 bg-red-50")}>
                {selected ? selected.name : <span className="text-muted-foreground">Sélectionner...</span>}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onOpenAdvanced}><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const SupplierSelector = ({ value, onChange, suppliers, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = suppliers.find((s:any) => s.id === value);
    return (
        <div className="flex gap-1">
            <div className={cn("flex-1 border rounded-md px-3 py-2 text-sm", hasError && "border-red-500 bg-red-50")}>
                {selected ? selected.name : <span className="text-muted-foreground">Sélectionner...</span>}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onOpenAdvanced}><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const ArticleSelector = ({ value, onChange, articles, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = articles.find((a:any) => a.id === value);
    return (
        <div className="flex gap-1 w-full">
             <div className="flex-1 border rounded-md px-3 py-2 text-sm truncate" onClick={onOpenAdvanced}>
                {selected ? selected.name : <span className="text-muted-foreground">Saisir un article...</span>}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onOpenAdvanced}><Search className="h-4 w-4" /></Button>
        </div>
    )
}

// --- DATE PICKER ---
const DatePickerField = ({ selected, onSelect }: any) => {
    // Simplified for robustness
    return (
        <div className="border rounded-md px-3 py-2 text-sm">
             {selected ? format(selected, 'dd/MM/yyyy') : "Date"}
        </div>
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

  const [size, setSize] = useState({ width: 900, height: 500 }) // SMALLER DEFAULT HEIGHT
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

  const calculateNextNumber = (receipts: PurchaseReceipt[]) => {
    if (!receipts || receipts.length === 0) return "BR-0001";
    const maxId = receipts.reduce((max, r) => {
        const num = parseInt(r.receiptNumber.replace("BR-", "") || "0", 10);
        return num > max ? num : max;
    }, 0);
    return `BR-${(maxId + 1).toString().padStart(4, '0')}`;
  };

  const resetForm = () => {
    setDate(new Date())
    setDueDate(new Date())
    setSupplierId("")
    setPaymentMethod("cash")
    setRepresentativeId("")
    setReference("")
    setRemarks("")
    setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }])
    setPosition({ x: 0, y: 0 })
    setShowCloseAlert(false)
    setIsShaking(false)
    setFormErrors({}) 
    setReceiptNumber(calculateNextNumber(existingReceipts));
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

  const handleCreateReceipt = async () => {
    if (!db) return;
    
    // --- VALIDATION START ---
    const newErrors: any = {};
    let hasError = false;

    if (!supplierId) { newErrors.supplier = true; hasError = true; }
    if (!receiptNumber.trim()) { newErrors.receiptNumber = true; hasError = true; }
    const validItems = items.filter(i => i.articleId && i.qty > 0);
    if (validItems.length === 0) { newErrors.items = true; hasError = true; }

    if (hasError) {
        setFormErrors(newErrors);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
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
            setTimeout(() => {
                resetForm();
                setIsSubmitting(false);
            }, 300);
        }

    } catch (error) {
        console.error("Failed", error);
        setIsSubmitting(false);
    }
  }

  const addItem = () => {
    const id = generateId()
    const newItem = { id, articleId: "", qty: 1, price: 0, tva: 20 }
    setItems([...items, newItem])
    setNewRowId(id) 
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleLineChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    let finalValue = value;
    if (field === 'qty') finalValue = Number(value) < 1 ? 1 : Number(value);
    if (field === 'price') finalValue = Number(value) < 0 ? 0 : Number(value);
    setItems(prev => prev.map(item => {
        if (item.id === id) return { ...item, [field]: finalValue }
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

  const handleRepresentativeCreated = (newRep: any) => {
      const repWithType = newRep as Representative
      setAvailableRepresentatives(prev => deduplicate([repWithType, ...prev]))
      setRepresentativeId(repWithType.id)
  }

  const handleSupplierCreated = (newSupplier: any) => {
      const supplierWithType = newSupplier as Supplier
      setAvailableSuppliers(prev => deduplicate([supplierWithType, ...prev]))
      setSupplierId(supplierWithType.id)
  }

  useEffect(() => {
    const getSidebarWidth = () => {
      const sidebar = document.querySelector('aside');
      return sidebar ? sidebar.getBoundingClientRect().width : 0;
    }
    setDockOffset(getSidebarWidth());
  }, [])
  
  // RESET POSITION ON OPEN
  useEffect(() => {
    if (open && !isMinimized) {
        setPosition({ x: 0, y: 0 })
    }
  }, [open, isMinimized])

  // --- MOUSE HANDLERS FOR DRAG ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (isMinimized) return;
      if ((e.target as HTMLElement).closest('button')) return; // Ignore buttons
      
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

  // --- RENDER ---
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open Test Dialog
      </Button>

      <Dialog open={open} onOpenChange={setOpen} modal={!isMinimized}>
        <DialogContent 
          onInteractOutside={(e) => { e.preventDefault(); }}
          className={cn(
              "p-0 overflow-hidden bg-transparent border-none shadow-none max-w-none w-auto h-auto transition-[width,height] duration-200 ease-in-out [&>button]:!hidden pointer-events-none",
              isMinimized && "fixed bottom-0 z-[9999]"
          )}
          style={{
             width: isMinimized ? (isHoveringDock ? 600 : 280) : size.width,
             height: isMinimized ? (isHoveringDock ? 500 : "auto") : size.height,
             left: isMinimized ? (dockOffset || 0) + 16 : "50%",
             top: isMinimized ? 'auto' : '50%',
             bottom: isMinimized ? '0px' : 'auto',
             transform: isMinimized ? "none" : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          }}
        >
          <div 
            className={cn(
              "relative bg-white border rounded-lg shadow-xl flex flex-col pointer-events-auto h-full max-h-[85vh]",
              isMinimized && "rounded-b-none border-b-0 cursor-pointer hover:bg-slate-50"
            )}
            onClick={isMinimized ? () => setIsMinimized(false) : undefined}
            onMouseEnter={() => isMinimized && setIsHoveringDock(true)}
            onMouseLeave={() => isMinimized && setIsHoveringDock(false)}
          >
            {/* HEADER */}
            <div 
                onMouseDown={handleMouseDown}
                className="flex-none p-4 border-b flex justify-between items-center select-none cursor-move"
            >
                <div className="font-semibold text-sm">
                    {isMinimized ? `Bon ${receiptNumber}` : "Nouveau Bon de Réception"}
                </div>
                <div className="flex gap-2">
                    <button onClick={(e) => {e.stopPropagation(); setIsMinimized(true)}}><Minus className="h-4 w-4" /></button>
                    <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-red-500" /></button>
                </div>
            </div>

            {/* CONTENT (HIDDEN WHEN MINIMIZED) */}
            <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden", isMinimized && !isHoveringDock && "hidden")}>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* FORM */}
                    <div className="flex w-full gap-6">
                         <div className="w-1/2 space-y-4">
                            <div className="border p-3 rounded">
                                <Label>Numéro</Label>
                                <Input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} />
                            </div>
                            <div className="border p-3 rounded">
                                <Label>Fournisseur</Label>
                                <SupplierSelector 
                                    value={supplierId} 
                                    onChange={setSupplierId} 
                                    suppliers={availableSuppliers} 
                                    onOpenAdvanced={() => setIsSupplierSearchOpen(true)}
                                    onCreateNew={() => setIsCreateSupplierOpen(true)}
                                    hasError={formErrors.supplier}
                                />
                            </div>
                         </div>
                         <div className="w-1/2 space-y-4">
                            <div className="border p-3 rounded">
                                <Label>Détails</Label>
                                <div className="space-y-2 mt-2">
                                    <RepresentativeSelector 
                                        value={representativeId}
                                        onChange={setRepresentativeId}
                                        representatives={availableRepresentatives}
                                        onOpenAdvanced={() => setIsRepresentativeSearchOpen(true)}
                                        onCreateNew={() => setIsCreateRepOpen(true)}
                                    />
                                    <Input placeholder="Remarque..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                                </div>
                            </div>
                         </div>
                     </div>
                     <div className="border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-2 text-left">Article</th>
                                    <th className="p-2 w-20">Qté</th>
                                    <th className="p-2 w-20">Prix</th>
                                    <th className="p-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={item.id} className="border-b">
                                        <td className="p-2">
                                            <ArticleSelector 
                                                value={item.articleId}
                                                onChange={(v:string) => handleArticleChange(item.id, v)}
                                                articles={availableArticles}
                                                onOpenAdvanced={() => { setSearchTargetRowId(item.id); setIsSearchOpen(true); }}
                                                onCreateNew={() => { setPendingRowId(item.id); setIsCreateArticleOpen(true); }}
                                            />
                                        </td>
                                        <td className="p-2"><Input type="number" value={item.qty} onChange={e => handleLineChange(item.id, 'qty', e.target.value)} /></td>
                                        <td className="p-2"><Input type="number" value={item.price} onChange={e => handleLineChange(item.id, 'price', e.target.value)} /></td>
                                        <td className="p-2"><Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Button variant="ghost" className="w-full" onClick={addItem}>+ Ajouter ligne</Button>
                     </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="font-bold">Total: {totalTTC.toFixed(2)} €</div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                        <Button onClick={handleCreateReceipt}>Créer</Button>
                    </div>
                </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB DIALOGS */}
      <ArticleDialog 
        isOpen={isCreateArticleOpen}
        onOpenChange={setIsCreateArticleOpen}
        onArticleCreated={handleArticleCreated}
        articles={availableArticles} 
        isChild={true} 
      />
      <RepresentativeDialog
        isOpen={isCreateRepOpen}
        onOpenChange={setIsCreateRepOpen}
        onRepresentativeCreated={handleRepresentativeCreated}
        representatives={availableRepresentatives}
      />
      <SupplierDialog
        isOpen={isCreateSupplierOpen}
        onOpenChange={setIsCreateSupplierOpen}
        onSupplierCreated={handleSupplierCreated}
        suppliers={availableSuppliers}
      />
      <SupplierSearchDialog 
        isOpen={isSupplierSearchOpen}
        onOpenChange={setIsSupplierSearchOpen}
        onSelect={(s:any) => { setSupplierId(s.id); setIsSupplierSearchOpen(false); }}
        suppliers={availableSuppliers}
        onCreateNew={() => { setIsSupplierSearchOpen(false); setIsCreateSupplierOpen(true); }} 
      />
      <RepresentativeSearchDialog 
        isOpen={isRepresentativeSearchOpen}
        onOpenChange={setIsRepresentativeSearchOpen}
        onSelect={(r:any) => { setRepresentativeId(r.id); setIsRepresentativeSearchOpen(false); }}
        representatives={availableRepresentatives}
        onCreateNew={() => { setIsRepresentativeSearchOpen(false); setIsCreateRepOpen(true); }} 
      />
      <ArticleSearchDialog 
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleArticleSearchSelect}
        articles={availableArticles}
        onCreateNew={() => { setIsSearchOpen(false); if(searchTargetRowId) handleCreateNewArticle(searchTargetRowId); }} 
      />
    </>
  )
}
We are introducing a "Medium View" on hover for the minimized dialog dock item.

Please overwrite `src/components/test-resizable-dialog.tsx` with the code below.

**Changes:**
1.  **State:** Added `isHoveringDock` to track hover status.
2.  **Mouse Handlers:** Added `onMouseEnter` and `onMouseLeave` to the main dialog container to trigger the medium view.
3.  **Dynamic Styles:** * Width expands from `280px` -> `600px` on hover.
    * Height expands from `auto` -> `500px` on hover.
    * Content visibility check changed to `isMinimized && !isHoveringDock && "hidden"`.
4.  **Transition:** Added smooth transitions to the container so it grows upwards nicely.

```tsx
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

// --- SUB-COMPONENTS ---

// 1. Representative Search Dialog
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
    return representatives.filter((r:any) => r.name.toLowerCase().includes(lowerTerm));
  }, [searchTerm, representatives]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <div className="p-4 border-b">
             <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
        </div>
        <div 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b"
        >
            <PlusCircle className="h-4 w-4" /> Nouveau
        </div>
        <div className="flex-1 overflow-auto p-0 max-h-[400px]">
            {filteredReps.map((rep: any) => (
                <div key={rep.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(rep)}>
                    {rep.name}
                </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 2. Supplier Search Dialog
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
    return suppliers.filter((s:any) => s.name.toLowerCase().includes(lowerTerm));
  }, [searchTerm, suppliers]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <div className="p-4 border-b">
             <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
        </div>
        <div 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b"
        >
            <PlusCircle className="h-4 w-4" /> Nouveau
        </div>
        <div className="flex-1 overflow-auto p-0 max-h-[400px]">
            {filteredSuppliers.map((s: any) => (
                <div key={s.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(s)}>
                    {s.name}
                </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 3. Article Search Dialog
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
    return articles.filter((a:any) => a.name.toLowerCase().includes(lowerTerm) || a.code.toLowerCase().includes(lowerTerm));
  }, [searchTerm, articles]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 z-[99999]">
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <div className="p-4 border-b">
             <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
        </div>
        <div 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 font-semibold bg-blue-50/50 hover:bg-blue-100 cursor-pointer border-b"
        >
            <PlusCircle className="h-4 w-4" /> Nouveau
        </div>
        <div className="flex-1 overflow-auto p-0 max-h-[400px]">
            {filteredArticles.map((a: any) => (
                <div key={a.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer flex justify-between" onClick={() => onSelect(a)}>
                    <span>{a.code} - {a.name}</span>
                    <span>{a.price} €</span>
                </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- SELECTOR COMPONENTS ---
const RepresentativeSelector = ({ value, onChange, representatives, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = representatives.find((r:any) => r.id === value);
    return (
        <div className="flex gap-1">
            <div className={cn("flex-1 border rounded-md px-3 py-2 text-sm", hasError && "border-red-500 bg-red-50")}>
                {selected ? selected.name : <span className="text-muted-foreground">Sélectionner...</span>}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onOpenAdvanced}><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const SupplierSelector = ({ value, onChange, suppliers, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = suppliers.find((s:any) => s.id === value);
    return (
        <div className="flex gap-1">
            <div className={cn("flex-1 border rounded-md px-3 py-2 text-sm", hasError && "border-red-500 bg-red-50")}>
                {selected ? selected.name : <span className="text-muted-foreground">Sélectionner...</span>}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onOpenAdvanced}><Search className="h-4 w-4" /></Button>
        </div>
    )
}

const ArticleSelector = ({ value, onChange, articles, onOpenAdvanced, onCreateNew, hasError }: any) => {
    const selected = articles.find((a:any) => a.id === value);
    return (
        <div className="flex gap-1 w-full">
             <div className="flex-1 border rounded-md px-3 py-2 text-sm truncate" onClick={onOpenAdvanced}>
                {selected ? selected.name : <span className="text-muted-foreground">Saisir un article...</span>}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onOpenAdvanced}><Search className="h-4 w-4" /></Button>
        </div>
    )
}

// --- DATE PICKER ---
const DatePickerField = ({ selected, onSelect }: any) => {
    return (
        <div className="border rounded-md px-3 py-2 text-sm">
             {selected ? format(selected, 'dd/MM/yyyy') : "Date"}
        </div>
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

  const [size, setSize] = useState({ width: 900, height: 500 }) // FIXED: Smaller default height
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

  const calculateNextNumber = (receipts: PurchaseReceipt[]) => {
    if (!receipts || receipts.length === 0) return "BR-0001";
    const maxId = receipts.reduce((max, r) => {
        const num = parseInt(r.receiptNumber.replace("BR-", "") || "0", 10);
        return num > max ? num : max;
    }, 0);
    return `BR-${(maxId + 1).toString().padStart(4, '0')}`;
  };

  const resetForm = () => {
    setDate(new Date())
    setDueDate(new Date())
    setSupplierId("")
    setPaymentMethod("cash")
    setRepresentativeId("")
    setReference("")
    setRemarks("")
    setItems([{ id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }])
    setPosition({ x: 0, y: 0 })
    setShowCloseAlert(false)
    setIsShaking(false)
    setFormErrors({}) 
    setReceiptNumber(calculateNextNumber(existingReceipts));
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

  const handleCreateReceipt = async () => {
    if (!db) return;
    
    // --- VALIDATION START ---
    const newErrors: any = {};
    let hasError = false;

    if (!supplierId) { newErrors.supplier = true; hasError = true; }
    if (!receiptNumber.trim()) { newErrors.receiptNumber = true; hasError = true; }
    const validItems = items.filter(i => i.articleId && i.qty > 0);
    if (validItems.length === 0) { newErrors.items = true; hasError = true; }

    if (hasError) {
        setFormErrors(newErrors);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
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
            setTimeout(() => {
                resetForm();
                setIsSubmitting(false);
            }, 300);
        }

    } catch (error) {
        console.error("Failed", error);
        setIsSubmitting(false);
    }
  }

  const addItem = () => {
    const id = generateId()
    const newItem = { id, articleId: "", qty: 1, price: 0, tva: 20 }
    setItems([...items, newItem])
    setNewRowId(id) 
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleLineChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    let finalValue = value;
    if (field === 'qty') finalValue = Number(value) < 1 ? 1 : Number(value);
    if (field === 'price') finalValue = Number(value) < 0 ? 0 : Number(value);
    setItems(prev => prev.map(item => {
        if (item.id === id) return { ...item, [field]: finalValue }
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

  const handleRepresentativeCreated = (newRep: any) => {
      const repWithType = newRep as Representative
      setAvailableRepresentatives(prev => deduplicate([repWithType, ...prev]))
      setRepresentativeId(repWithType.id)
  }

  const handleSupplierCreated = (newSupplier: any) => {
      const supplierWithType = newSupplier as Supplier
      setAvailableSuppliers(prev => deduplicate([supplierWithType, ...prev]))
      setSupplierId(supplierWithType.id)
  }

  useEffect(() => {
    const getSidebarWidth = () => {
      const sidebar = document.querySelector('aside');
      return sidebar ? sidebar.getBoundingClientRect().width : 0;
    }
    setDockOffset(getSidebarWidth());
  }, [])
  
  // RESET POSITION ON OPEN
  useEffect(() => {
    if (open && !isMinimized) {
        setPosition({ x: 0, y: 0 })
    }
  }, [open, isMinimized])

  // --- MOUSE HANDLERS FOR DRAG ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (isMinimized) return;
      if ((e.target as HTMLElement).closest('button')) return; // Ignore buttons
      
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

  // --- RENDER ---
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open Test Dialog
      </Button>

      <Dialog open={open} onOpenChange={setOpen} modal={!isMinimized}>
        <DialogContent 
          onInteractOutside={(e) => { e.preventDefault(); }}
          className={cn(
              "p-0 overflow-hidden bg-transparent border-none shadow-none max-w-none w-auto h-auto transition-[width,height] duration-200 ease-in-out [&>button]:!hidden pointer-events-none",
              isMinimized && "fixed bottom-0 z-[9999]"
          )}
          style={{
             width: isMinimized ? (isHoveringDock ? 600 : 280) : size.width,
             height: isMinimized ? (isHoveringDock ? 500 : "auto") : "auto", 
             maxHeight: isMinimized ? "none" : "85vh", // VIEWPORT CONSTRAINT
             left: isMinimized ? (dockOffset || 0) + 16 : "50%",
             top: isMinimized ? 'auto' : '50%',
             bottom: isMinimized ? '0px' : 'auto',
             transform: isMinimized ? "none" : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          }}
        >
          <div 
            className={cn(
              "relative bg-white border rounded-lg shadow-xl flex flex-col pointer-events-auto h-full",
              isMinimized && "rounded-b-none border-b-0 cursor-pointer hover:bg-slate-50"
            )}
            onClick={isMinimized ? () => setIsMinimized(false) : undefined}
            onMouseEnter={() => isMinimized && setIsHoveringDock(true)}
            onMouseLeave={() => isMinimized && setIsHoveringDock(false)}
          >
            {/* HEADER */}
            <div 
                onMouseDown={handleMouseDown}
                className="flex-none p-4 border-b flex justify-between items-center select-none cursor-move"
            >
                <div className="font-semibold text-sm">
                    {isMinimized ? `Bon ${receiptNumber}` : "Nouveau Bon de Réception"}
                </div>
                <div className="flex gap-2">
                    <button onClick={(e) => {e.stopPropagation(); setIsMinimized(true)}}><Minus className="h-4 w-4" /></button>
                    <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-red-500" /></button>
                </div>
            </div>

            {/* CONTENT (HIDDEN WHEN MINIMIZED) */}
            <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden", isMinimized && !isHoveringDock && "hidden")}>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* FORM CONTENT */}
                    <div className="flex w-full gap-6">
                         <div className="w-1/2 space-y-4">
                            <div className="border p-3 rounded">
                                <Label>Numéro</Label>
                                <Input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} />
                            </div>
                            <div className="border p-3 rounded">
                                <Label>Fournisseur</Label>
                                <SupplierSelector 
                                    value={supplierId} 
                                    onChange={setSupplierId} 
                                    suppliers={availableSuppliers} 
                                    onOpenAdvanced={() => setIsSupplierSearchOpen(true)}
                                    onCreateNew={() => setIsCreateSupplierOpen(true)}
                                    hasError={formErrors.supplier}
                                />
                            </div>
                         </div>
                         <div className="w-1/2 space-y-4">
                            <div className="border p-3 rounded">
                                <Label>Détails</Label>
                                <div className="space-y-2 mt-2">
                                    <RepresentativeSelector 
                                        value={representativeId}
                                        onChange={setRepresentativeId}
                                        representatives={availableRepresentatives}
                                        onOpenAdvanced={() => setIsRepresentativeSearchOpen(true)}
                                        onCreateNew={() => setIsCreateRepOpen(true)}
                                    />
                                    <Input placeholder="Remarque..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                                </div>
                            </div>
                         </div>
                     </div>
                     <div className="border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-2 text-left">Article</th>
                                    <th className="p-2 w-20">Qté</th>
                                    <th className="p-2 w-20">Prix</th>
                                    <th className="p-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={item.id} className="border-b">
                                        <td className="p-2">
                                            <ArticleSelector 
                                                value={item.articleId}
                                                onChange={(v:string) => handleArticleChange(item.id, v)}
                                                articles={availableArticles}
                                                onOpenAdvanced={() => { setSearchTargetRowId(item.id); setIsSearchOpen(true); }}
                                                onCreateNew={() => { setPendingRowId(item.id); setIsCreateArticleOpen(true); }}
                                            />
                                        </td>
                                        <td className="p-2"><Input type="number" value={item.qty} onChange={e => handleLineChange(item.id, 'qty', e.target.value)} /></td>
                                        <td className="p-2"><Input type="number" value={item.price} onChange={e => handleLineChange(item.id, 'price', e.target.value)} /></td>
                                        <td className="p-2"><Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Button variant="ghost" className="w-full" onClick={addItem}>+ Ajouter ligne</Button>
                     </div>
                </div>

                {/* FOOTER (ALWAYS VISIBLE) */}
                <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="font-bold">Total: {totalTTC.toFixed(2)} €</div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                        <Button onClick={handleCreateReceipt}>Créer</Button>
                    </div>
                </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB DIALOGS */}
      <ArticleDialog 
        isOpen={isCreateArticleOpen}
        onOpenChange={setIsCreateArticleOpen}
        onArticleCreated={handleArticleCreated}
        articles={availableArticles} 
        isChild={true} 
      />
      <RepresentativeDialog
        isOpen={isCreateRepOpen}
        onOpenChange={setIsCreateRepOpen}
        onRepresentativeCreated={handleRepresentativeCreated}
        representatives={availableRepresentatives}
      />
      <SupplierDialog
        isOpen={isCreateSupplierOpen}
        onOpenChange={setIsCreateSupplierOpen}
        onSupplierCreated={handleSupplierCreated}
        suppliers={availableSuppliers}
      />
      <SupplierSearchDialog 
        isOpen={isSupplierSearchOpen}
        onOpenChange={setIsSupplierSearchOpen}
        onSelect={(s:any) => { setSupplierId(s.id); setIsSupplierSearchOpen(false); }}
        suppliers={availableSuppliers}
        onCreateNew={() => { setIsSupplierSearchOpen(false); setIsCreateSupplierOpen(true); }} 
      />
      <RepresentativeSearchDialog 
        isOpen={isRepresentativeSearchOpen}
        onOpenChange={setIsRepresentativeSearchOpen}
        onSelect={(r:any) => { setRepresentativeId(r.id); setIsRepresentativeSearchOpen(false); }}
        representatives={availableRepresentatives}
        onCreateNew={() => { setIsRepresentativeSearchOpen(false); setIsCreateRepOpen(true); }} 
      />
      <ArticleSearchDialog 
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleArticleSearchSelect}
        articles={availableArticles}
        onCreateNew={() => { setIsSearchOpen(false); if(searchTargetRowId) handleCreateNewArticle(searchTargetRowId); }} 
      />
    </>
  )
}
