'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, PurchaseOrder, CreditNote, Supplier, Representative } from '@/lib/types';
import { Separator } from './ui/separator';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ArticleDialog } from './article-dialog';
import { SupplierDialog } from './supplier-dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';

const creditNoteItemSchema = z.object({
  productId: z.string().nonempty("Veuillez sélectionner un article."),
  quantity: z.coerce
    .number()
    .int()
    .min(0, 'La quantité doit être un entier non négatif.'),
  price: z.coerce.number().optional(),
  tvaRate: z.coerce.number().min(0, "Le taux de TVA doit être un nombre positif."),
});

const purchaseCreditNoteSchema = z.object({
  creditNoteNumber: z.string().nonempty("Le numéro de document est requis."),
  supplierId: z.string().nonempty("Un fournisseur doit être sélectionné."),
  creditNoteDate: z.date({ required_error: 'La date est requise.' }),
  items: z.array(creditNoteItemSchema).min(1, "L'avoir doit contenir au moins un article."),
  paymentMode: z.string().optional(),
  dueDate: z.date().nullable(),
  representativeId: z.string().optional(),
  reference: z.string().optional(),
  remarks: z.string().optional(),
});

type PurchaseCreditNoteFormValues = z.infer<typeof purchaseCreditNoteSchema>;

type PurchaseCreditNoteDialogProps = {
  // Props will be re-added as needed.
};

export function PurchaseCreditNoteDialog() {
  const [open, setOpen] = useState(false);
  const { register, control, handleSubmit, watch, setValue } = useForm<PurchaseCreditNoteFormValues>({
    resolver: zodResolver(purchaseCreditNoteSchema),
    defaultValues: {
      creditNoteNumber: "AV-0001",
      creditNoteDate: new Date(),
      supplierId: "",
      paymentMode: "Espèces",
      dueDate: null,
      representativeId: "",
      reference: "",
      remarks: "",
      items: [{ productId: '', quantity: 1, price: 0, tvaRate: 20 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const onSubmit = (data: PurchaseCreditNoteFormValues) => {
    console.log("Creating Credit Note:", data);
    // Call your actual mutation here
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Créer un avoir fournisseur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Créer un avoir fournisseur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* MASTER GRID LAYOUT - RESPONSIVE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ZONE 1: INFORMATIONS PIÈCE */}
            <div className="border border-blue-800 p-4 rounded-md relative lg:col-span-4">
              <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-semibold text-blue-800">
                Informations pièce
              </h3>
              <div className="space-y-4 pt-2">
                {/* Numéro - FORCED FULL WIDTH */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right">Numéro</Label>
                  <Input 
                    {...register('creditNoteNumber')} 
                    placeholder="Ex: AV-0001"
                    className="w-full" 
                  />
                </div>
                {/* Date - FORCED FULL WIDTH */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !watch('creditNoteDate') && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watch('creditNoteDate') ? format(watch('creditNoteDate'), "P") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={watch('creditNoteDate')}
                        onSelect={(date) => setValue('creditNoteDate', date as Date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            {/* ZONE 2: FOURNISSEUR */}
            <div className="border border-blue-800 p-4 rounded-md relative lg:col-span-8">
              <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-semibold text-blue-800">
                Fournisseur
              </h3>
              <div className="pt-2">
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right">Fournisseur</Label>
                  <Select onValueChange={(value) => setValue('supplierId', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionnez un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sup-1">Fournisseur A</SelectItem>
                      <SelectItem value="sup-2">Fournisseur B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* ZONE 3: RÈGLEMENT */}
            <div className="border border-blue-800 p-4 rounded-md relative lg:col-span-4">
              <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-semibold text-blue-800">
                Règlement
              </h3>
              <div className="space-y-4 pt-2">
                {/* Mode de paiement - FORCED FULL WIDTH */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right leading-tight">Mode de paiement</Label>
                  <Select onValueChange={(value) => setValue('paymentMode', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Espèces" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Espèces">Espèces</SelectItem>
                      <SelectItem value="Chèque">Chèque</SelectItem>
                      <SelectItem value="Virement">Virement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Date d'échéance - FORCED FULL WIDTH */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right leading-tight">Date d'échéance</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !watch('dueDate') && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watch('dueDate') ? format(watch('dueDate') as Date, "P") : <span>mm/dd/yyyy</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={watch('dueDate') || undefined}
                        onSelect={(date) => setValue('dueDate', date as Date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            {/* ZONE 4: DÉTAILS */}
            <div className="border border-blue-800 p-4 rounded-md relative lg:col-span-8">
              <h3 className="absolute -top-3 left-3 bg-background px-2 text-sm font-semibold text-blue-800">
                Détails
              </h3>
              <div className="space-y-4 pt-2">
                 {/* Représentant */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right">Représentant</Label>
                  <Select onValueChange={(value) => setValue('representativeId', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Représentant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rep-1">Représentant 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Référence */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right">Référence</Label>
                  <Input {...register('reference')} placeholder="Référence" className="w-full" />
                </div>
                {/* Remarques */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <Label className="text-right">Remarques</Label>
                  <Input {...register('remarks')} placeholder="Remarques" className="w-full" />
                </div>
              </div>
            </div>
          </div>
          {/* ITEMS TABLE SECTION */}
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="mb-4 grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
              <div className="col-span-5">Article</div>
              <div className="col-span-2">Qté</div>
              <div className="col-span-2">Prix UHT</div>
              <div className="col-span-1">TVA (%)</div>
              <div className="col-span-2 text-right">Total HT</div>
            </div>
            
            {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center mb-2">
                    <div className="col-span-5">
                        <Select onValueChange={v => setValue(`items.${index}.productId`, v)}>
                            <SelectTrigger><SelectValue placeholder="Article" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="prod-1">Produit A</SelectItem>
                                <SelectItem value="prod-2">Produit B</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-2"><Input type="number" {...register(`items.${index}.quantity`)} /></div>
                    <div className="col-span-2"><Input type="number" {...register(`items.${index}.price`)} /></div>
                    <div className="col-span-1"><Input type="number" {...register(`items.${index}.tvaRate`)} /></div>
                    <div className="col-span-2 text-right font-medium">
                        {/* Calculate line total */}
                        {((watch(`items.${index}.quantity`) || 0) * (watch(`items.${index}.price`) || 0)).toFixed(2)} €
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
            ))}

            <Button type="button" variant="outline" onClick={() => append({ productId: '', quantity: 1, price: 0, tvaRate: 20 })} className="mt-2">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>
          {/* FOOTER TOTALS */}
          <div className="space-y-2 pt-4 text-right">
             {/* Totals will be calculated and displayed here */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit">Créer l'avoir</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    )
}
