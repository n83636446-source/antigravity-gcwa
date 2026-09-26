import React, { useState, useEffect, useMemo, useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogTitle, DialogPortal } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Minus, Loader2, X } from "lucide-react"
import { isSameDay, format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn, roundMoney, isDuplicateNumber, generateId } from "@/lib/utils"

 
import { api } from "@/lib/api"
import { supplierFromApi, purchaseInvoiceFromApi } from "@/lib/types";
import type { PurchaseInvoice, Reglement, Supplier } from "@/lib/types" 
import { useToast } from "@/hooks/use-toast" 

import { useSidebar } from "@/components/ui/sidebar"
import { useShakeWarning } from "@/hooks/use-shake-warning"

// --- SHARED UI IMPORTS ---
import {
  SupplierSelector,
  DatePickerField,
} from "@/components/purchase-dialog-shared-ui"

interface ReglementTestDialogProps {
  purchaseInvoice: PurchaseInvoice | null;
    onSaveSuccess?: () => void;
}

export function ReglementTestDialog({ purchaseInvoice, onSaveSuccess }: ReglementTestDialogProps) {
  const [open, setOpen] = useState<boolean>(!!purchaseInvoice || true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHoveringDock, setIsHoveringDock] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { state, isMobile } = useSidebar();
  const dockOffset = isMobile ? 0 : (state === 'expanded' ? 256 : 48);
  const dialogRef = useRef<HTMLDivElement>(null);
  
  const [showCloseAlert, setShowCloseAlert] = useState(false);
  const { shakeTick, overlayShakeTick, triggerFieldShake, triggerOverlayShake } = useShakeWarning();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingReglements, setExistingReglements] = useState<Reglement[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<PurchaseInvoice[]>([]);
  
  // Interactive Selection State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  // Form states
  const [reglementNumber, setReglementNumber] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [reference, setReference] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [formErrors, setFormErrors] = useState<{ amount?: boolean; reglementNumber?: boolean; supplier?: boolean; invoice?: boolean }>({});

  const initialValuesRef = useRef<any>(null);
  ;
  const { toast } = useToast();

  const calculateNextNumber = (reglements: Reglement[]) => {
    if (!reglements || reglements.length === 0) return "RG0001";
    const maxId = reglements.reduce((max, r) => {
      const codeDigits = r.reglementNumber.replace("RG", "").trim();
      const numVal = parseInt(codeDigits, 10);
      return isNaN(numVal) ? max : (numVal > max ? numVal : max);
    }, 0);
    return `RG${(maxId + 1).toString().padStart(4, '0')}`;
  };

  const supplierUnpaidInvoices = useMemo(
    () => unpaidInvoices.filter(inv => inv.supplierId === selectedSupplierId),
    [unpaidInvoices, selectedSupplierId]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [suppliersSnap, reglementsSnap, invoicesSnap] = await Promise.all([
          api.getSuppliers().then(res => res.map(supplierFromApi)),
          api.getReglements(), // already returns mapped Reglement[]
          api.getPurchaseInvoices().then(res => res.map(purchaseInvoiceFromApi))
        ]);
        
        setAvailableSuppliers(suppliersSnap);
        const existing = reglementsSnap;
        setExistingReglements(existing);
        setUnpaidInvoices(invoicesSnap.filter(inv => inv.status === 'Non payée' || inv.status === 'Partiellement payée'));
const nextNum = calculateNextNumber(existing);
        setReglementNumber(nextNum);
        setDate(new Date());

        // Pre-fill from prop if provided (FA Test entry)
        if (purchaseInvoice) {
            setSelectedSupplierId(purchaseInvoice.supplierId);
            setSelectedInvoice(purchaseInvoice);
            const remaining = roundMoney(purchaseInvoice.totalTTC - (purchaseInvoice.amountPaid || 0));
            setAmount(remaining);
            setPaymentMode(purchaseInvoice.paymentMode || "cash");
            if (purchaseInvoice.dueDate) setDueDate(new Date(purchaseInvoice.dueDate));
        }

        initialValuesRef.current = {
            reglementNumber: nextNum,
            date: new Date(),
            amount: purchaseInvoice ? roundMoney(purchaseInvoice.totalTTC - (purchaseInvoice.amountPaid || 0)) : 0,
            paymentMode: purchaseInvoice?.paymentMode || "cash",
            reference: "",
            remarks: "",
            supplierId: purchaseInvoice?.supplierId || "",
            invoiceId: purchaseInvoice?.id || null
        };
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    if (open) fetchData();
  }, [open, purchaseInvoice]);

  const isFormDirty = () => {
    if (!initialValuesRef.current) return false;
    if (reglementNumber !== initialValuesRef.current.reglementNumber) return true;
    if (!isSameDay(date, initialValuesRef.current.date)) return true;
    if (amount !== initialValuesRef.current.amount) return true;
    if (paymentMode !== initialValuesRef.current.paymentMode) return true;
    if (reference !== initialValuesRef.current.reference) return true;
    if (remarks !== initialValuesRef.current.remarks) return true;
    if (selectedSupplierId !== initialValuesRef.current.supplierId) return true;
    if (selectedInvoice?.id !== initialValuesRef.current.invoiceId) return true;
    return false;
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (isFormDirty()) {
        if (isMinimized) setIsMinimized(false);
        setShowCloseAlert(true);
        return;
      }
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  const confirmClose = () => {
    setShowCloseAlert(false);
    setOpen(false);
  };

  const handleCreateReglement = async () => {
    
    
    const newErrors: typeof formErrors = {};
    let hasError = false;

    if (!selectedSupplierId) { newErrors.supplier = true; hasError = true; }
    if (!selectedInvoice) { newErrors.invoice = true; hasError = true; }

    const remaining = selectedInvoice ? roundMoney(selectedInvoice.totalTTC - (selectedInvoice.amountPaid || 0)) : 0;
    if (amount <= 0 || amount > remaining) {
      newErrors.amount = true;
      hasError = true;
    }
    if (isDuplicateNumber(existingReglements, 'reglementNumber', reglementNumber)) {
      newErrors.reglementNumber = true;
      hasError = true;
    }

    if (hasError) {
      setFormErrors(newErrors);
      triggerFieldShake();
      return;
    }

    if (!selectedInvoice) return;

    setIsSubmitting(true);
    try {
      const newReglement: any = {
        id: generateId(),
        reglement_number: reglementNumber,
        purchase_invoice_id: selectedInvoice.id,
        supplier_id: selectedSupplierId!,
        date: date.toISOString(),
        amount: amount,
        payment_mode: paymentMode || null,
        reference: reference || null,
        remarks: remarks || null,
        status: "Actif"
      };
      await api.submitReglement(newReglement);


              toast({ title: "Succès", description: `Règlement ${reglementNumber} enregistré avec succès.` });
            onSaveSuccess?.();
      setOpen(false);
    } catch (error) {
      console.error("Transaction failed:", error);
      toast({ variant: 'destructive', title: "Erreur", description: "Une erreur est survenue lors de l'enregistrement." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMinimized) setIsHoveringDock(false);
  };

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
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.reglementNumber && "text-red-500")}>Numéro *</Label>
                          <div key={shakeTick} className={cn("w-full min-0", formErrors.reglementNumber && "animate-shake")}>
                            <Input value={reglementNumber} onChange={(e) => setReglementNumber(e.target.value)} className={cn("w-full min-w-0 font-mono", formErrors.reglementNumber && "border-red-500 focus-visible:ring-red-500")} />
                          </div>
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Date</Label>
                          <DatePickerField selected={date} onSelect={setDate} placeholder="JJ/MM/AAAA" />
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Fournisseur</h3>
                     <div className="space-y-4 pt-2">
                        <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                           <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.supplier && "text-red-500")}>Fournisseur *</Label>
                           <div key={shakeTick} className={cn("w-full", formErrors.supplier && "animate-shake")}>
                               <SupplierSelector value={selectedSupplierId} onChange={(id) => { setSelectedSupplierId(id); setSelectedInvoice(null); }} suppliers={availableSuppliers} onOpenAdvanced={() => {}} onCreateNew={() => {}} hasError={formErrors.supplier} />
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
                          <Select value={paymentMode} onValueChange={setPaymentMode}>
                              <SelectTrigger className="w-full flex items-center justify-between overflow-hidden [&>span]:truncate [&>span]:flex-1 [&>span]:min-w-0 [&>svg]:shrink-0 [&>svg]:ml-2">
                                  <SelectValue placeholder="Espèces" />
                              </SelectTrigger>
                              <SelectContent><SelectItem value="cash">Espèces</SelectItem></SelectContent>
                           </Select>
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={isMobileSize ? "text-left" : "text-right"}>Date d'échéance</Label>
                          <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="JJ/MM/AAAA" minDate={date} />
                       </div>
                       <div className={cn("grid items-center gap-4", isMobileSize ? "grid-cols-1 gap-2" : "grid-cols-[110px_1fr]")}>
                          <Label className={cn(isMobileSize ? "text-left" : "text-right", formErrors.amount && "text-red-500")}>Mt Règlement *</Label>
                          <div key={shakeTick} className={cn("w-full", formErrors.amount && "animate-shake")}>
                             <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={cn("w-full min-w-0 font-bold text-blue-900", formErrors.amount && "border-red-500 focus-visible:ring-red-500")} />
                             {formErrors.amount && <span className="text-xs text-red-500 mt-1 block font-normal">Le montant ne peut pas dépasser le solde dû.</span>}
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className={cn("border border-blue-800 p-4 rounded-md relative", isMobileSize ? "w-full" : "w-[60%]")}>
                    <h3 className="absolute -top-3 left-3 bg-white px-2 text-sm font-semibold text-blue-800">Détails</h3>
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

          <div key={shakeTick} className={cn("mt-2", formErrors.invoice && "animate-shake")}>
             {selectedSupplierId && (
               <div className="border border-blue-800 rounded-md overflow-hidden bg-white shadow-sm">
                 <div className="bg-slate-50 border-b border-blue-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Factures non payées</div>
                 <table className="w-full text-sm">
                   <thead className="bg-slate-50 border-b">
                     <tr className="text-left text-muted-foreground">
                       <th className="h-10 px-4 font-medium">Échéance</th>
                       <th className="h-10 px-4 font-medium">N° pièce</th>
                       <th className="h-10 px-4 font-medium text-right">Solde dû</th>
                     </tr>
                   </thead>
                   <tbody>
                     {supplierUnpaidInvoices.length === 0 ? (
                       <tr><td colSpan={3} className="p-8 text-center text-muted-foreground italic">Aucune facture non payée pour ce fournisseur.</td></tr>
                     ) : supplierUnpaidInvoices.map(inv => {
                       const remaining = roundMoney(inv.totalTTC - (inv.amountPaid || 0));
                       const isSelected = selectedInvoice?.id === inv.id;
                       return (
                         <tr key={inv.id} className={cn("cursor-pointer border-b last:border-0 hover:bg-slate-50 transition-colors", isSelected && "bg-blue-50/50")} onClick={() => setSelectedInvoice(inv)}>
                           <td className="px-4 py-2.5">{inv.dueDate ? format(new Date(inv.dueDate), "dd/MM/yyyy") : "—"}</td>
                           <td className="px-4 py-2.5 font-mono text-xs">{inv.invoiceNumber}</td>
                           <td className="px-4 py-2.5 text-right font-semibold">{remaining.toFixed(2)} €</td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
                 {formErrors.invoice && <div className="bg-red-50 text-red-600 text-xs px-4 py-2 border-t border-red-100 font-medium text-center">Veuillez sélectionner une facture dans la liste.</div>}
               </div>
             )}
          </div>
        </form>
      </div>

      <div className="flex-none p-6 pt-4 border-t bg-gray-50 rounded-b-lg text-right">
        <div className="space-y-2 mb-4">
            <div className="flex justify-end gap-4 font-bold text-lg text-blue-900"><span>Total Règlement:</span> <span>{(amount || 0).toFixed(2)} €</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
          <Button className="bg-slate-900 text-white px-8 font-bold" disabled={isSubmitting} onClick={handleCreateReglement}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validation...</> : "Valider le règlement"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
        <DialogPortal>
          <div className="fixed inset-0 z-40 flex pointer-events-none transition-all duration-300 ease-in-out">
             {!isMobile && <div className="flex-none transition-all duration-300 ease-in-out" style={{ width: dockOffset }} />}

             <div className="flex-1 relative pointer-events-none h-full w-full">
                {open && !isMinimized && (
                    <div 
                        className="absolute inset-0 z-40 bg-black/80 pointer-events-auto transition-all duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                        onClick={(e) => { e.stopPropagation(); triggerOverlayShake(); }}
                    />
                )}

                <DialogPrimitive.Content 
                    onInteractOutside={(e) => e.preventDefault()}
                    className={cn(
                        "p-0 overflow-visible bg-transparent border-none shadow-none max-w-none w-auto h-auto transition-all duration-300 ease-in-out [&>button]:!hidden pointer-events-none outline-none focus:outline-none",
                        isMinimized 
                        ? "absolute bottom-[10px] left-4 z-[9999] w-fit max-w-fit translate-x-0 translate-y-0"
                        : "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-auto"
                    )}
                    style={isMinimized ? { transition: "all 0.3s ease-in-out" } : { width: "96%", height: "96%", transition: "all 0.3s ease-in-out" }}
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
                        style={{ width: "100%", height: isMinimized ? 40 : "100%", transformOrigin: isMinimized ? "bottom left" : "center", transition: "all 0.3s ease-in-out" }}
                    >
                        {showCloseAlert && (
                            <div className="absolute inset-0 z-[10000] flex items-center justify-center rounded-lg p-4 bg-black/5" onClick={triggerOverlayShake}>
                              <div 
                                  key={overlayShakeTick}
                                  className="bg-white border shadow-lg p-6 rounded-md max-w-sm text-center animate-shake"
                                  onClick={(e) => e.stopPropagation()}
                              >
                                  <h3 className="font-semibold text-lg mb-2">Attention</h3>
                                  <p className="text-sm text-muted-foreground mb-6">
                                    Voulez-vous enregistrer le règlement {reglementNumber} avant de fermer ?
                                  </p>
                                  <div className="flex justify-center gap-2">
                                      <Button className="bg-slate-900 text-white min-w-[70px]" size="sm" onClick={() => { setShowCloseAlert(false); handleCreateReglement(); }}>Oui</Button>
                                      <Button variant="destructive" size="sm" className="min-w-[70px]" onClick={confirmClose}>Non</Button>
                                      <Button variant="outline" size="sm" className="min-w-[70px]" onClick={() => setShowCloseAlert(false)}>Annuler</Button>
                                  </div>
                              </div>
                            </div>
                        )}

                        {isMinimized && (
                            <div className={cn("absolute bottom-full left-1/2 -translate-x-1/2 pb-3 z-[10000] origin-bottom transition-all duration-300 ease-out", isHoveringDock ? "scale-100 opacity-100 pointer-events-auto" : "scale-0 opacity-0 pointer-events-none")}>
                            <div className="group bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden cursor-pointer relative" style={{ width: 800 * 0.25, height: 700 * 0.25 }} onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}>
                                <button onClick={(e) => { e.stopPropagation(); setOpen(false); setIsHoveringDock(false); }} className="absolute top-2 right-2 z-50 p-1.5 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 rounded-md transition-opacity duration-200 shadow-sm pointer-events-auto opacity-0 group-hover:opacity-100"><X className="h-4 w-4" /></button>
                                <div className="pointer-events-none origin-top-left bg-white flex flex-col" style={{ width: 800, height: 700, transform: 'scale(0.25)' }}>
                                    <div className="flex-none p-4 flex items-center gap-2 font-semibold text-sm">Créer un règlement</div>
                                    <div className="flex-1 min-h-0 flex flex-col">{formAndFooterJSX}</div>
                                </div>
                            </div>
                            </div>
                        )}

                        <div className="absolute right-3 top-3 z-50 flex gap-1">
                            {!isMinimized && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleOpenChange(false)} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-colors cursor-pointer"><X className="h-4 w-4" /></button>
                            </>
                            )}
                        </div>

                        <div className={cn("flex-none p-4 select-none flex items-center gap-2", !isMinimized && "cursor-default", isMinimized && "py-0 px-3 h-10")}>
                            {isMinimized && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                            <div className={cn("font-semibold text-sm", isMinimized ? "whitespace-nowrap pr-2" : "truncate pr-12")}>{isMinimized ? `Règlement - ${reglementNumber}` : "Créer un règlement"}</div>
                        </div>
                        
                        {!isMinimized && <div className="px-6 pb-4 border-b text-muted-foreground text-sm text-left">Remplissez les informations ci-dessous.</div>}

                        <div className={cn("flex-col flex-1 min-h-0 transition-opacity duration-300", isMinimized ? "hidden" : "flex")}>
                            <DialogTitle className="sr-only">Créer un règlement</DialogTitle>
                            {formAndFooterJSX}
                        </div>
                    </div>
                </DialogPrimitive.Content>
             </div>
          </div>
        </DialogPortal>
      </Dialog>
    </>
  );
}















