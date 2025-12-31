import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

// --- 1. OUR CUSTOM, UNBREAKABLE CALENDAR ---
const SimpleCalendar = ({ selected, onSelect }: { selected: Date | undefined, onSelect: (d: Date) => void }) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  // Generate days
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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-sm capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* DAYS HEADER (L M M J V S D) */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => <span key={d} className="text-gray-400 font-medium">{d}</span>)}
      </div>

      {/* CALENDAR GRID */}
      <div className="grid grid-cols-7 gap-1 text-sm">
        {daysInMonth().map((d, i) => {
           const isSelected = selected && isSameDay(d, selected)
           const isCurrentMonth = isSameMonth(d, currentMonth)
           return (
             <button
               key={i}
               onClick={(e) => { e.preventDefault(); onSelect(d) }}
               className={cn(
                 "h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors",
                 !isCurrentMonth && "text-gray-300",
                 isCurrentMonth && "text-gray-700 hover:bg-gray-100",
                 isSelected && "bg-slate-900 text-white hover:bg-slate-800"
               )}
             >
               {format(d, "d")}
             </button>
           )
        })}
      </div>
    </div>
  )
}

export function TestResizableDialog() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>()
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [size, setSize] = useState({ width: 1000, height: 800 })

  // Resize Logic
  const handleMouseDown = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault()
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

  // Updated helper using our SimpleCalendar
  const DatePickerField = ({ selected, onSelect, placeholder }: any) => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    
    const handleSelectDate = (date: Date) => {
        onSelect(date);
        setPopoverOpen(false); // Close popover on date selection
    }

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full flex items-center justify-between px-3 text-left font-normal overflow-hidden",
                        !selected && "text-muted-foreground"
                    )}
                >
                    <span className="truncate flex-1 min-w-0">
                        {selected ? format(selected, "d MMMM yyyy", { locale: fr }) : placeholder}
                    </span>
                    <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            
            <PopoverContent className="w-auto p-0 border-0" align="start">
                 <SimpleCalendar selected={selected} onSelect={handleSelectDate} />
            </PopoverContent>
        </Popover>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>Open Test Dialog</Button>
      <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] p-0 overflow-hidden bg-transparent border-none shadow-none sm:max-w-[none] w-auto h-auto">
        <div className="relative bg-white border rounded-lg shadow-xl flex flex-col" style={{ width: size.width, height: size.height }}>
          
          <div className="flex-none p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>Créer un bon de réception</DialogTitle>
              <DialogDescription>Remplissez les informations ci-dessous.</DialogDescription>
            </DialogHeader>
          </div>
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
                              <SelectContent><SelectItem value="f1">Fournisseur A</SelectItem></SelectContent>
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
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button className="bg-slate-900 text-white">Créer</Button>
            </DialogFooter>
          </div>
          {/* Resize Handles */}
          <div onMouseDown={handleMouseDown('right')} className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-50 hover:bg-blue-400/50 transition-colors" />
          <div onMouseDown={handleMouseDown('bottom')} className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize z-50 hover:bg-blue-400/50 transition-colors" />
          <div onMouseDown={handleMouseDown('corner')} className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize z-50 bg-slate-200 hover:bg-blue-400 rounded-tl-md" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
