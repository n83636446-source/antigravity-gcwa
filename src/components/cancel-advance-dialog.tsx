'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import type { PurchaseAdvance, PurchaseInvoice } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePickerField } from '@/components/purchase-dialog-shared-ui';

const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

interface CancelAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  supplierName: string;
  advances: PurchaseAdvance[];
  suggestedAdvanceNumber: string;
  suggestedReglementNumber: string;
  onSaved: () => void;
}

export function CancelAdvanceDialog({
  open,
  onOpenChange,
  invoice,
  supplierName,
  advances,
  suggestedAdvanceNumber,
  suggestedReglementNumber,
  onSaved,
}: CancelAdvanceDialogProps) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [paymentMode, setPaymentMode] = useState('cash');
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    const today = new Date();
    setSelectedId(null);
    setDate(today);
    setDueDate(today);
    setPaymentMode('cash');
    setShowErrors(false);
  }, [open, invoice]);

  const selectionError = !selectedId ? "Choisissez l'acompte à annuler." : null;
  const dateError = !date ? 'La date est obligatoire.' : null;

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!invoice || !selectedId || !date || selectionError || dateError) return;
    setIsSubmitting(true);
    try {
      const saved = await api.cancelPurchaseAdvance(selectedId, {
        id: `ac-${generateId()}`,
        advance_number: suggestedAdvanceNumber,
        reglement_id: `rg-${generateId()}`,
        reglement_number: suggestedReglementNumber,
        advance_date: date.toISOString(),
        payment_mode: paymentMode || null,
        due_date: dueDate ? dueDate.toISOString() : null,
      });
      toast({
        title: 'Acompte annulé',
        description: `L'annulation ${saved.advance_number} a été créée avec son règlement ${suggestedReglementNumber}.`,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Annulation d'acompte impossible",
        description: (error instanceof Error && error.message) || "L'annulation a échoué.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Annulation d'acompte</DialogTitle>
          <DialogDescription>
            {`${supplierName} — Facture ${invoice?.invoiceNumber ?? ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <p className="mb-1 text-sm">Acompte à annuler</p>
            <div className="rounded-md border text-sm">
              <div className="grid grid-cols-[32px_1fr_110px_120px] border-b bg-muted/50 px-2 py-1 font-medium">
                <span />
                <span>Numéro</span>
                <span>Date</span>
                <span className="text-right">Montant TTC</span>
              </div>
              {advances.map((a) => (
                <label
                  key={a.id}
                  className="grid cursor-pointer grid-cols-[32px_1fr_110px_120px] items-center px-2 py-1.5 hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="advance-to-cancel"
                    checked={selectedId === a.id}
                    onChange={() => setSelectedId(a.id)}
                  />
                  <span>{a.advanceNumber}</span>
                  <span>{format(new Date(a.advanceDate), 'dd/MM/yyyy')}</span>
                  <span className="text-right">{currencyFormatter.format(a.totalTTC)}</span>
                </label>
              ))}
            </div>
            {showErrors && selectionError && <p className="mt-1 text-sm text-red-500">{selectionError}</p>}
          </div>

          <div className="grid grid-cols-[130px_1fr] items-center gap-2">
            <span className="text-sm">Date</span>
            <div>
              <DatePickerField selected={date} onSelect={setDate} placeholder="JJ/MM/AAAA" />
              {showErrors && dateError && <p className="mt-1 text-sm text-red-500">{dateError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-center gap-2">
            <span className="text-sm">Mode paiement</span>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue placeholder="Espèces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Espèces</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-center gap-2">
            <span className="text-sm">Date échéance</span>
            <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="JJ/MM/AAAA" />
          </div>

          <p className="text-xs text-muted-foreground">
            {`L'annulation ${suggestedAdvanceNumber} et son règlement ${suggestedReglementNumber} seront créés automatiquement.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Fermer</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
