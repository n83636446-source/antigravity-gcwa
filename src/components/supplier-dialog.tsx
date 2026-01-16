'use client';

import { useEffect, useMemo } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { Supplier } from '@/lib/types';
import { Textarea } from './ui/textarea';

const supplierSchema = z.object({
  code: z.string().min(1, "Le code fournisseur est requis."),
  name: z.string().min(2, "Le nom de l'entreprise doit contenir au moins 2 caractères."),
  contactName: z.string().min(2, 'Le nom du contact est requis.'),
  contactEmail: z.string().email('Veuillez saisir une adresse e-mail valide.'),
  contactPhone: z.string().min(10, 'Veuillez saisir un numéro de téléphone valide.'),
  street: z.string().min(5, "La rue doit contenir au moins 5 caractères."),
  city: z.string().min(2, "La ville doit contenir au moins 2 caractères."),
  country: z.string().min(2, "Le pays doit contenir au moins 2 caractères."),
  ice: z.string().regex(/^[0-9]{15}$/, "L'ICE doit contenir exactement 15 chiffres."),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

type SupplierDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  supplier?: Supplier;
  // REMOVED: lastSupplierCodeNumber (Calculated internally now)
  onSupplierCreated?: (supplier: Supplier) => void;
  suppliers: Supplier[];
};

export function SupplierDialog({ 
    isOpen, 
    onOpenChange, 
    supplier, 
    onSupplierCreated,
    suppliers = [], // Default to empty array
}: SupplierDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!supplier;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  // 1. SMART CALCULATION: Find the next FOUxxx code
  const nextCode = useMemo(() => {
    if (!suppliers || suppliers.length === 0) return "FOU001";

    const maxId = suppliers.reduce((max, s) => {
      if (!s.code) return max;
      // Extract numbers regardless of prefix (FOU001 -> 1)
      const digits = String(s.code).replace(/\D/g, '');
      const num = digits ? parseInt(digits, 10) : 0;
      return num > max ? num : max;
    }, 0);

    return `FOU${(maxId + 1).toString().padStart(3, '0')}`;
  }, [suppliers]);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && supplier) {
        form.reset(supplier);
      } else {
        // Use the smart calculation
        form.reset({
          code: nextCode,
          name: '',
          contactName: '',
          contactEmail: '',
          contactPhone: '',
          street: '',
          city: '',
          country: '',
          ice: '',
        });
      }
    }
  }, [supplier, isEditMode, isOpen, form, nextCode]);

  const onSubmit = async (data: SupplierFormValues) => {
    if (!firestore) return;

    // --- NEW VALIDATION: CHECK DUPLICATE CODE ---
    const codeExists = suppliers.some(
      s => s.code?.toLowerCase() === data.code.toLowerCase() && s.id !== supplier?.id
    );

    if (codeExists) {
      form.setError('code', {
        type: 'manual',
        message: 'Ce code fournisseur existe déjà.',
      });
      return;
    }

    // --- EXISTING VALIDATIONS ---
    
    // Check for unique ICE
    const iceExists = suppliers.some(
      s => s.ice === data.ice && s.id !== supplier?.id
    );

    if (iceExists) {
      form.setError('ice', {
        type: 'manual',
        message: 'Cet ICE est déjà utilisé par un autre fournisseur.',
      });
      return;
    }

    // Check for unique phone number
    const phoneExists = suppliers.some(
      s => s.contactPhone === data.contactPhone && s.id !== supplier?.id
    );

    if (phoneExists) {
      form.setError('contactPhone', {
        type: 'manual',
        message: 'Ce numéro de téléphone est déjà utilisé par un autre fournisseur.',
      });
      return;
    }

    // Check for unique email
    const emailExists = suppliers.some(
        s => s.contactEmail === data.contactEmail && s.id !== supplier?.id
    );

    if (emailExists) {
        form.setError('contactEmail', {
            type: 'manual',
            message: 'Cet e-mail est déjà utilisé par un autre fournisseur.',
        });
        return;
    }
    
    if (isEditMode && supplier) {
      const supplierDocRef = doc(firestore, 'suppliers', supplier.id);
      updateDocumentNonBlocking(supplierDocRef, data);
      toast({
        title: 'Fournisseur modifié',
        description: `Le fournisseur "${data.name}" a été mis à jour.`,
      });
      onSupplierCreated?.({ ...data, id: supplier.id });
    } else {
      const suppliersRef = collection(firestore, 'suppliers');
      const docRef = await addDocumentNonBlocking(suppliersRef, data);
      toast({
        title: 'Fournisseur ajouté',
        description: `Le fournisseur "${data.name}" a été ajouté avec succès.`,
      });
      if (docRef) {
        onSupplierCreated?.({ ...data, id: docRef.id });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? 'Modifier le fournisseur' : 'Ajouter un nouveau fournisseur'}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Modifiez les informations du fournisseur."
                  : "Remplissez les détails du nouveau fournisseur."
                }
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code Fournisseur</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: FOU001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'entreprise</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Global Electronics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="ice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ICE</FormLabel>
                  <FormControl>
                    <Input placeholder="Identifiant Commun de l'Entreprise" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rue</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Adresse complète du fournisseur" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Casablanca" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Maroc" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personne à contacter</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email du contact</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ex: jean.dupont@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone du contact</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="ex: 01-23-45-67-89" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit">{isEditMode ? 'Enregistrer les modifications' : 'Ajouter le fournisseur'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
