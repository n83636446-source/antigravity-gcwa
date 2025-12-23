'use client';

import { useState, useEffect } from 'react';
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
import { useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const creditNoteSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur doit être sélectionné.'),
  creditNoteDate: z.string().nonempty("La date de l'avoir est requise."),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0."),
  reason: z.string().min(5, "La raison doit contenir au moins 5 caractères."),
});

type CreditNoteFormValues = z.infer<typeof creditNoteSchema>;

type CreditNoteDialogProps = {
  suppliers: Supplier[];
  onCreditNoteCreated?: (creditNote: CreditNote) => void;
  lastCreditNoteNumber: number;
};

export function CreditNoteDialog({
  suppliers,
  onCreditNoteCreated,
  lastCreditNoteNumber,
}: CreditNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteSchema),
  });

  useEffect(() => {
    if (open) {
        form.reset({
            supplierId: '',
            creditNoteDate: new Date().toISOString().split('T')[0],
            amount: 0,
            reason: '',
        });
    }
  }, [open, form]);

  const onSubmit = (data: CreditNoteFormValues) => {
    if (!firestore) return;
    
    const newCreditNoteNumber = `AV-${(lastCreditNoteNumber + 1)
      .toString()
      .padStart(4, '0')}`;
      
    const newCreditNoteData: Omit<CreditNote, 'id'> = {
      creditNoteNumber: newCreditNoteNumber,
      supplierId: data.supplierId,
      creditNoteDate: new Date(data.creditNoteDate).toISOString(),
      amount: data.amount,
      reason: data.reason,
      status: 'Brouillon',
    };

    const creditNotesRef = collection(firestore, 'creditNotes');
    addDocumentNonBlocking(creditNotesRef, newCreditNoteData);

    toast({
      title: 'Avoir créé',
      description: `L'avoir "${newCreditNoteNumber}" a été créé avec succès.`,
    });
    
    onCreditNoteCreated?.(newCreditNoteData as CreditNote);

    setOpen(false);
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
                  <FormItem>
                    <FormLabel>Date de l'avoir</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
