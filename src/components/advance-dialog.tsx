'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PurchaseInvoice } from '@/lib/types';
import { generateId, roundMoney } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePickerField } from '@/components/purchase-dialog-shared-ui';

const TVA_RATES = ['20', '14', '10', '7', '0'];
const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

interface AdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  supplierName: string;
  suggestedAdvanceNumber: string;
  suggestedReglementNumber: string;
  onSaved: () => void;
}

export function AdvanceDialog({
  open,
  onOpenChange,
  invoice,
  supplierName,
  suggestedAdvanceNumber,
  suggestedReglementNumber,
  onSaved,
}: AdvanceDialogProps) {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [reference, setReference] = useState('');
  const [amountText, setAmountText] = useState('');
  const [tvaRate, setTvaRate] = useState('20');
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    const today = new Date();
    setDate(today);
    setDueDate(today);
    setDescription(`Acompte versé sur [Facture - ${invoice.invoiceNumber}]`);
    setPaymentMode('cash');
    setReference('');
    setAmountText('');
    setTvaRate('20');
    setShowErrors(false);
  }, [open, invoice]);

  const totalTTC = invoice?.totalTTC ?? 0;
  const paid = invoice?.amountPaid ?? 0;
  const advance = invoice?.advanceTotal ?? 0;
  const balance = roundMoney(totalTTC - paid - advance);
  const amount = Number(amountText.replace(',', '.'));

  const amountError =
    !amountText.trim() || Number.isNaN(amount) || amount <= 0
      ? 'Saisissez un montant supérieur à zéro.'
      : roundMoney(amount) > balance
        ? `Le montant dépasse le solde dû (${currencyFormatter.format(balance)}).`
        : null;
  const dateError = !date ? 'La date est obligatoire.' : null;

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!invoice || amountError || dateError || !date) return;
    setIsSubmitting(true);
    try {
      const saved = await api.enterPurchaseAdvance({
        id: `ac-${generateId()}`,
        advance_number: suggestedAdvanceNumber,
        reglement_id: `rg-${generateId()}`,
        reglement_number: suggestedReglementNumber,
        purchase_invoice_id: invoice.id,
        advance_date: date.toISOString(),
        payment_mode: paymentMode || null,
        due_date: dueDate ? dueDate.toISOString() : null,
        reference: reference.trim() || null,
        description: description.trim() || null,
        amount_ttc: roundMoney(amount),
        tva_rate: Number(tvaRate),
      });
      toast({
        title: 'Acompte enregistré',
        description: `La facture d'acompte ${saved.advance_number} a été créée et réglée automatiquement (${suggestedReglementNumber}).`,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Saisie d'acompte impossible",
        description: (error instanceof Error && error.message) || "L'enregistrement a échoué.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Saisie d'acompte</DialogTitle>
          <DialogDescription>
            {`${supplierName} — Facture ${invoice?.invoiceNumber ?? ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-[130px_1fr] items-center gap-2">
            <span className="text-sm">Date</span>
            <div>
              <DatePickerField selected={date} onSelect={setDate} placeholder="JJ/MM/AAAA" />
              {showErrors && dateError && <p className="mt-1 text-sm text-red-500">{dateError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-start gap-2">
            <span className="pt-2 text-sm">Description</span>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
            <span className="text-sm">Référence</span>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <div className="grid grid-cols-[130px_1fr] items-center gap-2">
            <span className="text-sm">Date échéance</span>
            <DatePickerField selected={dueDate} onSelect={setDueDate} placeholder="JJ/MM/AAAA" />
          </div>

          <div className="grid grid-cols-[130px_1fr] items-start gap-2">
            <span className="pt-2 text-sm">Acompte (TTC)</span>
            <div>
              <Input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className={showErrors && amountError ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {showErrors && amountError && <p className="mt-1 text-sm text-red-500">{amountError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-center gap-2">
            <span className="text-sm">TVA</span>
            <Select value={tvaRate} onValueChange={setTvaRate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TVA_RATES.map((rate) => (
                  <SelectItem key={rate} value={rate}>{`${rate} %`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between"><span>Montant dû</span><span>{currencyFormatter.format(totalTTC)}</span></div>
            <div className="flex justify-between"><span>Montant réglé</span><span>{currencyFormatter.format(paid)}</span></div>
            {advance !== 0 && (
              <div className="flex justify-between"><span>Acompte déjà saisi</span><span>{currencyFormatter.format(advance)}</span></div>
            )}
            <div className="flex justify-between font-medium"><span>Solde dû</span><span>{currencyFormatter.format(balance)}</span></div>
          </div>

          <p className="text-xs text-muted-foreground">
            {`La facture d'acompte ${suggestedAdvanceNumber} et son règlement ${suggestedReglementNumber} seront créés automatiquement.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
