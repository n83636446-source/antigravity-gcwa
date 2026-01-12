import React, { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight, X, Minus, Maximize2, PlusCircle, Save, AlertTriangle } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

// --- FIREBASE IMPORTS ---
import { collection, getDocs } from "firebase/firestore"
import { useFirestore } from "@/firebase" 
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
  id: string // Changed to string for safer UUID
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

// --- CUSTOM CALENDAR ---
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
        {['L', 'M', 'Me', 'J', 'V', 'S', 'D'].map((d, i) => <span key={`${d}-${i}`} className="text-gray-400 font-medium">{d}</span>)}
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
  const [dockOffset, setDockOffset] = useState(70)
  
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

  // --- FIRESTORE ---
  const db = useFirestore()

  // --- MODAL STATES ---
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false)
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false)
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false)
  
  const [pendingRowId, setPendingRowId] = useState<string | null>(null) // Changed to string for ID

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

  // --- CALCULATE LAST CODES ---
  const lastArticleCodeNumber = React.useMemo(() => {
    return availableArticles.reduce((max, article) => {
      const match = article.code.match(/ART(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
  }, [availableArticles]);

  const lastSupplierCodeNumber = React.useMemo(() => {
    return availableSuppliers.reduce((max, supplier) => {
      const match = supplier.code.match(/FOU(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
  }, [availableSuppliers]);

  // --- CALCULATE TOTALS ---
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

      // Helper to create a harsh square wave
      const createOsc = (freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // Square wave is naturally "buzzy" and "hollow"
        osc.type = "square"; 
        osc.frequency.setValueAtTime(freq, t);
        
        // Low volume because square waves are loud
        gain.gain.setValueAtTime(0.05, t);
        // Short decay
        gain.gain.exponentialRampToValueAtTime(0.00001, t + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(t + 0.3);
      }

      // Play two dissonant frequencies to create the "Wrong" texture
      createOsc(100); // Fundamental
      createOsc(106); // Clash note (approx. semi-tone difference)

    } catch (e) {
      console.error("Audio play failed", e);
    }
  }

  // --- TABLE ACTIONS ---
  const addItem = () => {
    const newItem = { id: generateId(), articleId: "", qty: 1, price: 0, tva: 20 }
    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  // Handle manual changes
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
    if (value === "create_new") {
        setPendingRowId(rowId)
        setIsCreateArticleOpen(true)
        return
    }
    const selectedArticle = availableArticles.find(a => a.id === value)
    if (selectedArticle) {
        setItems(items.map(item => 
            item.id === rowId 
                ? { ...item, articleId: value, price: selectedArticle.price, tva: selectedArticle.tva || 20 } 
                : item
        ))
    }
  }

  // --- CREATION CALLBACKS ---
  const handleArticleCreated = (newArticle: any) => {
     const articleWithType = newArticle as Article;
     // Deduplicate just in case
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
      if (value === "create_new_supplier") {
          setIsCreateSupplierOpen(true)
          return
      }
      setSupplierId(value)
  }

  const handleSupplierCreated = (newSupplier: any) => {
      const supplierWithType = newSupplier as Supplier
      setAvailableSuppliers(prev => deduplicate([supplierWithType, ...prev]))
      setSupplierId(supplierWithType.id)
  }


  // --- SIDEBAR OBSERVER (FIXED + SAFE) ---
  useEffect(() => {
    const findSidebar = () => {
      return document.querySelector('aside') || 
             document.querySelector('nav[class*="sidebar"]') ||
             document.querySelector('[data-sidebar]') ||
             document.querySelector('.sidebar')
    }
    const updateWidth = (el: Element) => {
       const width = el.getBoundingClientRect().width
       // If sidebar is hidden/collapsed (width 0), set offset to 0
       if (width === 0) setDockOffset(0) 
       else setDockOffset(width)
    }
    const sidebar = findSidebar()
    if (sidebar) updateWidth(sidebar)
    
    let observer: ResizeObserver | null = null
    if (sidebar) {
        observer = new ResizeObserver((entries) => {
            for (const entry of entries) updateWidth(entry.target)
        })
        observer.observe(sidebar)
    }
    const interval = setInterval(() => {
        const currentSidebar = findSidebar()
        if (currentSidebar) {
            updateWidth(currentSidebar)
        } else {
            // FALLBACK: If sidebar DOM element is gone, reset offset to 0
            setDockOffset(0)
        }
    }, 500)
    return () => {
        if (observer) observer.disconnect()
        clearInterval(interval)
    }
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
    // ATTEMPT TO CLOSE
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
    } 
    // OPEN
    else {
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

      {/* --- MODALS --- */}
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


      <Dialog open={open} onOpenChange={handleOpenChange} modal={!isMinimized}>
        <DialogContent 
          // Custom backdrop handler
          onInteractOutside={(e) => {
            e.preventDefault(); 
            if (isFormDirty()) {
               if (isMinimized) setIsMinimized(false);
               setShowCloseAlert(true);
               setIsShaking(true);
               setTimeout(() => setIsShaking(false), 400);
               playWarningSound();
            } else {
               setOpen(false);
               setTimeout(() => { resetForm(); setIsMinimized(false); }, 200);
            }
          }}
          className={cn(
              "p-0 overflow-visible bg-transparent border-none shadow-none sm:max-w-[none] w-auto h-auto transition-all duration-100 ease-in-out [&>button]:!hidden pointer-events-none",
              isMinimized 
                ? "fixed bottom-0 top-auto right-auto translate-x-0 translate-y-0 z-[200]" // Fix for sidebar overlap
                : "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50"
          )}
          style={isMinimized ? { left: dockOffset + 16, transition: "left 0.3s ease-out" } : {}}
        >
           <DialogTitle className="sr-only">Créer un bon de réception</DialogTitle>
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
            {/* --- CUSTOM ALERT OVERLAY (WITH SHAKE & DISSONANT BUZZER) --- */}
            {showCloseAlert && (
              <div 
                className="absolute inset-0 z-[60] flex items-center justify-center rounded-lg p-4 bg-black/5"
                onClick={handleOverlayClick}
              >
                <div 
                    className={cn(
                        "bg-white border shadow-lg p-6 rounded-md max-w-sm text-center",
                        isShaking && "animate-shake"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ALERT ICON */}
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
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
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* HEADER - No border-b here to allow clean separation with subtitle */}
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
              <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-6 pt-10">
                <form className="space-y-6">
                  <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-12")}>
                     
                     {/* ZONE 1 (Left) */}
                     <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-5")}>
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

                     {/* ZONE 2 (Right) */}
                     <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-7")}>
                        <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                         <div className="space-y-4 pt-2">
                            <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                               <Label className={isMobile ? "text-left" : "text-right"}>Fournisseur</Label>
                               <Select value={supplierId} onValueChange={handleSupplierChange}>
                                  <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                    <SelectValue placeholder="Sélectionnez un fournisseur" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem 
                                       value="create_new_supplier" 
                                       className="text-blue-600 font-semibold focus:text-blue-700 bg-blue-50 focus:bg-blue-100 cursor-pointer"
                                     >
                                       <div className="flex items-center gap-2">
                                           <PlusCircle className="h-4 w-4" />
                                           <span>Créer un nouveau fournisseur</span>
                                       </div>
                                     </SelectItem>
                                     {availableSuppliers.map(s => (
                                       <SelectItem key={s.id} value={s.id}>
                                         {s.name}
                                       </SelectItem>
                                     ))}
                                  </SelectContent>
                               </Select>
                            </div>
                         </div>
                     </div>

                     {/* ZONE 3 (Left) */}
                     <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-5")}>
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

                     {/* ZONE 4 (Right) */}
                     <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-7")}>
                        <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                        <div className="space-y-4 pt-2">
                           <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                              <Label className={isMobile ? "text-left" : "text-right"}>Représentant</Label>
                              <Select value={representativeId} onValueChange={handleRepresentativeChange}>
                                  <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                    <SelectValue placeholder="Sélectionnez un représentant" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem 
                                       value="create_new_rep" 
                                       className="text-blue-600 font-semibold focus:text-blue-700 bg-blue-50 focus:bg-blue-100 cursor-pointer"
                                     >
                                       <div className="flex items-center gap-2">
                                           <PlusCircle className="h-4 w-4" />
                                           <span>Créer un nouveau représentant</span>
                                       </div>
                                     </SelectItem>
                                     {availableRepresentatives.map(r => (
                                       <SelectItem key={r.id} value={r.id}>
                                         {r.name}
                                       </SelectItem>
                                     ))}
                                  </SelectContent>
                               </Select>
                           </div>
                           <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                              <Label className={isMobile ? "text-left" : "text-right"}>Référence</Label>
                              <Input 
                                placeholder="Référence" 
                                className="w-full min-w-0" 
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                              />
                           </div>
                        </div>
                     </div>

                  </div>

                  {/* Items Table - Added border-blue-800 */}
                  <div className="border border-blue-800 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="w-[40%] min-w-[200px]">Article</TableHead>
                          <TableHead className="w-[15%] min-w-[80px]">Qté</TableHead>
                          <TableHead className="w-[15%] min-w-[80px]">Prix UHT</TableHead>
                          <TableHead className="w-[15%] min-w-[80px]">TVA (%)</TableHead>
                          <TableHead className="w-[15%] text-right min-w-[80px]">Total HT</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Select 
                                value={item.articleId} 
                                onValueChange={(val) => handleArticleChange(item.id, val)}
                              >
                                <SelectTrigger className="w-full truncate flex items-center justify-between [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0">
                                    <SelectValue placeholder="Sélectionner un article..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {/* ALWAYS TOP: Create Action */}
                                  <SelectItem 
                                    value="create_new" 
                                    className="text-blue-600 font-semibold focus:text-blue-700 bg-blue-50 focus:bg-blue-100 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                        <PlusCircle className="h-4 w-4" />
                                        <span>Créer un nouvel article</span>
                                    </div>
                                  </SelectItem>
                                  
                                  {/* DATABASE ITEMS */}
                                  {availableArticles.map(a => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.name} <span className="text-muted-foreground ml-2 text-xs">({a.code})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                                <Input 
                                    type="number" 
                                    value={item.qty}
                                    min={1} 
                                    onChange={(e) => handleLineChange(item.id, 'qty', Number(e.target.value))}
                                    className="min-w-[60px]" 
                                />
                            </TableCell>
                            <TableCell>
                                <Input 
                                    type="number" 
                                    value={item.price} 
                                    min={0}
                                    onChange={(e) => handleLineChange(item.id, 'price', Number(e.target.value))}
                                    className="min-w-[60px] bg-slate-50" 
                                />
                            </TableCell>
                            <TableCell>
                                <Input 
                                    type="number" 
                                    value={item.tva} 
                                    readOnly 
                                    className="min-w-[60px] bg-slate-50" 
                                />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                                {(item.price * item.qty).toFixed(2)} €
                            </TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        <TableRow>
                          <TableCell colSpan={6}>
                             <Button type="button" variant="outline" className="w-full border-dashed text-muted-foreground" onClick={addItem}>
                                + Ajouter une ligne
                             </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </form>
              </div>

              {/* Footer */}
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
                <div onMouseDown={handleResize('right')} className="absolute -right-3 top-0 bottom-0 w-3 cursor-ew-resize z-50 hover:bg-blue-400/50 transition-colors" />
                <div onMouseDown={handleResize('bottom')} className="absolute -bottom-3 left-0 right-0 h-3 cursor-ns-resize z-50 hover:bg-blue-400/50 transition-colors" />
                <div onMouseDown={handleResize('corner')} className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize z-50 bg-slate-200 hover:bg-blue-400 rounded-tl-md" />
              </>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}