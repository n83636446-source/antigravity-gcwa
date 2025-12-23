'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Supplier, CreditNote } from '@/lib/types';
import { Calendar } from './ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const creditNoteSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur doit être sélectionné.'),
  creditNoteDate: z.date({ required_error: "La date de l'avoir est requise." }),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0."),
  reason: z.string().min(5, "La raison doit contenir au moins 5 caractères."),
});

type CreditNoteFormValues = z.infer<typeof creditNoteSchema>;

type CreditNoteDialogProps = {
  suppliers: Supplier[];
  onCreditNoteCreated: (creditNote: CreditNote) => void;
  lastCreditNoteNumber: number;
};

export function CreditNoteDialog({
  suppliers,
  onCreditNoteCreated,
  lastCreditNoteNumber,
}: CreditNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      supplierId: '',
      creditNoteDate: new Date(),
      amount: 0,
      reason: '',
    },
  });

  const onSubmit = (data: CreditNoteFormValues) => {
    const newCreditNoteNumber = `AV-${(lastCreditNoteNumber + 1)
      .toString()
      .padStart(4, '0')}`;
      
    const newCreditNote: CreditNote = {
      id: `cn-${Date.now()}`,
      creditNoteNumber: newCreditNoteNumber,
      supplierId: data.supplierId,
      creditNoteDate: data.creditNoteDate.toISOString(),
      amount: data.amount,
      reason: data.reason,
      status: 'Brouillon',
    };

    onCreditNoteCreated(newCreditNote);

    toast({
      title: 'Avoir créé',
      description: `L'avoir "${newCreditNote.creditNoteNumber}" a été créé avec succès.`,
    });
    setOpen(false);
    form.reset({
      supplierId: '',
      creditNoteDate: new Date(),
      amount: 0,
      reason: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Créer un avoir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Créer un avoir</DialogTitle>
              <DialogDescription>
                Remplissez les détails pour créer une nouvelle note de crédit.
              </DialogDescription>
            </DialogHeader>

            <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un fournisseur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="creditNoteDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de l'avoir</FormLabel>
                    <Button
                        type="button"
                        variant={'outline'}
                        className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                        onClick={() => setCalendarOpen(!isCalendarOpen)}
                    >
                        {field.value ? format(field.value, 'PPP', { locale: fr }) : <span>Choisissez une date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                    {isCalendarOpen && (
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                field.onChange(date);
                                setCalendarOpen(false);
                            }}
                            initialFocus
                            locale={fr}
                        />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ex: Retour de marchandises endommagées" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Créer l'avoir</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
