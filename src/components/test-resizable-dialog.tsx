import React, { useState, useEffect, useRef } from "react"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight, X, Minus, Maximize2 } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

// --- CUSTOM CALENDAR --- 
const SimpleCalendar = ({ selected, onSelect }: { selected: Date | undefined, onSelect: (d: Date) => void }) => { 
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
        <div className="p-3 bg-white rounded-md w-[280px]">
          <div className="flex items-center justify-between mb-4">
            <button onClick={(e) => { e.preventDefault(); prevMonth() }} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-semibold text-sm capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</span>
            <button onClick={(e) => { e.preventDefault(); nextMonth() }} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={`${d}-${i}`} className="text-gray-400 font-medium">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm mb-3">
            {daysInMonth().map((d, i) => {
               const isSelected = selected && isSameDay(d, selected)
               const isCurrentMonth = isSameMonth(d, currentMonth)
               const isToday = isSameDay(d, new Date())
               return (
                 <button
                   key={i}
                   onClick={(e) => { e.preventDefault(); onSelect(d) }}
                   className={cn(
                     "h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors",
                     !isCurrentMonth && "text-gray-300",
                     isCurrentMonth && "text-gray-700 hover:bg-gray-100",
                     isSelected && "bg-slate-900 text-white hover:bg-slate-800",
                     isToday && !isSelected && "border border-slate-500 font-semibold"
                   )}
                 >
                   {format(d, "d")}
                 </button>
               )
            })}
          </div>
          <div className="border-t pt-3 flex items-center gap-2">
             <div className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-md flex-1 text-center font-medium border">
                {selected ? format(selected, "dd/MM/yyyy") : "--/--/----"}
             </div>
             <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-xs font-medium"
                onClick={(e) => { e.preventDefault(); handleToday() }}
             >
                Aujourd'hui
             </Button>
          </div>
        </div>
    )
}

export function TestResizableDialog() { 
    const [open, setOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [isDragging, setIsDragging] = useState(false) // NEW: Performance Flag
    const [date, setDate] = useState(new Date())
    const [dueDate, setDueDate] = useState(new Date())
    const [size, setSize] = useState({ width: 1000, height: 800 })
    const [position, setPosition] = useState({ x: 0, y: 0 }) 
    const [dockOffset, setDockOffset] = useState(70)

    // --- ROBUST SIDEBAR OBSERVER --- 
    useEffect(() => { 
        const findSidebar = () => { 
            return document.querySelector('aside') || document.querySelector('nav[class*="sidebar"]') || document.querySelector('[data-sidebar]') || document.querySelector('.sidebar') 
        } 
        const updateWidth = (el: Element) => { 
            const width = el.getBoundingClientRect().width 
            if (width === 0) setDockOffset(70) 
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
            if (currentSidebar) updateWidth(currentSidebar)
        }, 1000)

        return () => {
            if (observer) observer.disconnect()
            clearInterval(interval)
        }
    }, [])

    const handleOpenChange = (newOpen: boolean) => { 
        setOpen(newOpen)
        if (!newOpen) { 
            setTimeout(() => { 
                setDate(new Date())
                setDueDate(new Date())
                setPosition({ x: 0, y: 0 })
                setIsMinimized(false) 
            }, 200) 
        } 
    }

    const toggleMinimize = () => { setIsMinimized(!isMinimized) }

    // --- DRAG LOGIC --- 
    const handleDragStart = (e: React.MouseEvent) => { 
        if (isMinimized) return 
        if (e.target !== e.currentTarget && !e.currentTarget.contains(e.target as Node)) return 
        e.preventDefault()

        setIsDragging(true) // Disable transitions
        const startX = e.clientX 
        const startY = e.clientY 
        const startPos = { ...position }

        const onMouseMove = (moveEvent: MouseEvent) => {
          const dx = moveEvent.clientX - startX
          const dy = moveEvent.clientY - startY
          setPosition({ x: startPos.x + dx, y: startPos.y + dy })
        }
        const onMouseUp = () => {
          setIsDragging(false) // Re-enable transitions
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

    const DatePickerField = ({ selected, onSelect, placeholder }: any) => ( 
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full flex items-center justify-between px-3 text-left font-normal overflow-hidden", !selected && "text-muted-foreground")}>
                    <span className="truncate flex-1 min-w-0">
                        {selected ? format(selected, "d MMMM yyyy", { locale: fr }) : placeholder}
                    </span>
                    <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0" align="start">
                <SimpleCalendar selected={selected} onSelect={onSelect} />
            </PopoverContent>
        </Popover>
    )

    return (
        <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
            <DialogTrigger asChild>
                <Button variant="outline" onClick={() => setOpen(true)}>Open Test Dialog</Button>
            </DialogTrigger>
            <DialogHeader className="sr-only">
              <DialogTitle>Créer un bon de réception</DialogTitle>
              <DialogDescription>Remplissez les informations ci-dessous.</DialogDescription>
            </DialogHeader>

            {/* OUTER SHELL (Handles Dock Positioning) 
              - 'duration-100': SUPER FAST reaction to sidebar toggle (0.1s).
              - 'z-30': Safe layering.
            */}
            <DialogContent 
                onInteractOutside={(e) => e.preventDefault()}
                className={cn(
                    "p-0 overflow-visible bg-transparent border-none shadow-none sm:max-w-[none] w-auto h-auto transition-all duration-100 ease-in-out [&>button]:hidden pointer-events-none",
                    isMinimized 
                      ? "fixed bottom-0 top-auto right-auto translate-x-0 translate-y-0 z-30"
                      : "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50"
                )}
                style={
                    isMinimized 
                      ? { left: dockOffset + 16 } 
                      : {}
                }
            >
                {/* INNER WINDOW (Handles Dragging & Sizing)
                    - 'duration-100': Fast minimize animation.
                    - 'transition-none' when dragging: Keeps dragging instant.
                */}
                <div 
                  className={cn(
                    "relative bg-white border rounded-t-lg shadow-xl flex flex-col pointer-events-auto",
                    isMinimized ? "rounded-b-none border-b-0 shadow-md hover:bg-slate-50" : "rounded-lg",
                    isDragging ? "transition-none" : "transition-all duration-100 ease-in-out"
                  )}
                  style={{ 
                    width: isMinimized ? 280 : size.width, 
                    height: isMinimized ? "auto" : size.height,
                    transform: isMinimized ? "translate(0px, 0px)" : `translate(${position.x}px, ${position.y}px)`
                  }}
                >
                  
                  {/* CONTROL BUTTONS */}
                  <div className="absolute right-3 top-3 z-50 flex gap-1">
                    <button 
                      onClick={toggleMinimize}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-1.5 opacity-60 hover:opacity-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      title={isMinimized ? "Agrandir" : "Réduire"}
                    >
                      {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                    <button 
                      onClick={() => handleOpenChange(false)}
                      onMouseDown={(e) => e.stopPropagation()} 
                      className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* HEADER */}
                  <div 
                    onMouseDown={handleDragStart}
                    className={cn(
                      "flex-none p-4 border-b select-none flex items-center gap-2",
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
                  {/* BODY & FOOTER */}
                  <div className={cn("flex flex-col flex-1 min-h-0", isMinimized && "hidden")}>
                    
                    <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-6 pt-10">
                      <form className="space-y-6">
                        <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-12")}>
                           {/* ZONE 1 */}
                           <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-4")}>
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
                           {/* ZONE 2 */}
                           <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-8")}>
                              <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                               <div className="space-y-4 pt-2">
                                  <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                     <Label className={isMobile ? "text-left" : "text-right"}>Fournisseur</Label>
                                     <Select>
                                        <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                          <SelectValue placeholder="Sélectionnez un fournisseur" />
                                        </SelectTrigger>
                                        <SelectContent><SelectItem value="f1">AS ROMA</SelectItem></SelectContent>
                                     </Select>
                                  </div>
                               </div>
                           </div>
                           {/* ZONE 3 */}
                           <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-4")}>
                              <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Règlement</h3>
                              <div className="space-y-4 pt-2">
                                 <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                    <Label className={isMobile ? "text-left" : "text-right"}>Mode de paiement</Label>
                                    <Select>
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
                           {/* ZONE 4 */}
                           <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobile ? "col-span-1" : "col-span-8")}>
                              <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
                              <div className="space-y-4 pt-2">
                                 <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                    <Label className={isMobile ? "text-left" : "text-right"}>Représentant</Label>
                                    <Select>
                                        <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                          <SelectValue placeholder="Sélectionnez un représentant" />
                                        </SelectTrigger>
                                        <SelectContent><SelectItem value="r1">Représentant 1</SelectItem></SelectContent>
                                     </Select>
                                 </div>
                                 <div className={cn("grid items-center gap-4", isMobile ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                                    <Label className={isMobile ? "text-left" : "text-right"}>Référence</Label>
                                    <Input placeholder="Référence" className="w-full min-w-0" />
                                 </div>
                              </div>
                           </div>
                        </div>
                        {/* Items Table */}
                        <div className="border rounded-md overflow-hidden">
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
                              <TableRow>
                                <TableCell>
                                  <Select defaultValue="article1">
                                    <SelectTrigger className="w-full truncate flex items-center justify-between [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="article1">Robe d'été à fleurs (Exemple)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell><Input type="number" defaultValue="1" className="min-w-[60px]" /></TableCell>
                                <TableCell><Input type="number" defaultValue="45.00" className="min-w-[60px]" /></TableCell>
                                <TableCell><Input type="number" defaultValue="20" className="min-w-[60px]" /></TableCell>
                                <TableCell className="text-right font-medium">45,00 €</TableCell>
                                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={6}>
                                   <Button variant="outline" className="w-full border-dashed text-muted-foreground">+ Ajouter une ligne</Button>
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
                          <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total HT:</span> <span>0,00 €</span></div>
                          <div className="flex justify-end gap-4"><span className="text-muted-foreground">Total TVA:</span> <span>0,00 €</span></div>
                          <div className="flex justify-end gap-4 font-bold text-lg"><span>Total TTC:</span> <span>0,00 €</span></div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
                        <Button className="bg-slate-900 text-white">Créer</Button>
                      </DialogFooter>
                    </div>
                  </div>
                  {/* Resize Handles */}
                  {!isMinimized && (
                    <>
                      <div onMouseDown={handleResize('right')} className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-50 hover:bg-blue-400/50 transition-colors" />
                      <div onMouseDown={handleResize('bottom')} className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize z-50 hover:bg-blue-400/50 transition-colors" />
                      <div onMouseDown={handleResize('corner')} className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize z-50 bg-slate-200 hover:bg-blue-400 rounded-tl-md" />
                    </>
                  )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
