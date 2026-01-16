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
import type { Representative } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';

const representativeSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  name: z
    .string()
    .min(2, 'Le nom du représentant doit contenir au moins 2 caractères.'),
  email: z.string().email('Veuillez saisir une adresse e-mail valide.'),
});

type RepresentativeFormValues = z.infer<typeof representativeSchema>;

type RepresentativeDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  representative?: Representative;
  onRepresentativeCreated?: (rep: Representative) => void;
  representatives: Representative[];
};

export function RepresentativeDialog({
  isOpen,
  onOpenChange,
  representative,
  onRepresentativeCreated,
  representatives = [],
}: RepresentativeDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!representative;

  const form = useForm<RepresentativeFormValues>({
    resolver: zodResolver(representativeSchema),
    defaultValues: {
      code: '',
      name: '',
      email: '',
    },
  });

  // 1. Calculate Next Code (Suggestion only)
  const nextCode = useMemo(() => {
    if (!representatives || representatives.length === 0) return "REP001";
    
    // Find highest number
    const maxId = representatives.reduce((max, rep) => {
      if (!rep.code) return max;
      const digits = String(rep.code).replace(/\D/g, '');
      const num = digits ? parseInt(digits, 10) : 0;
      return num > max ? num : max;
    }, 0);

    return `REP${(maxId + 1).toString().padStart(3, '0')}`;
  }, [representatives]);

  // 2. Reset form on open
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && representative) {
        form.reset({
            code: representative.code || '',
            name: representative.name,
            email: representative.email || '',
        });
      } else {
        form.reset({
          code: nextCode, // Pre-fill suggestion
          name: '',
          email: '',
        });
      }
    }
  }, [isOpen, isEditMode, representative, nextCode, form]);

  const onSubmit = async (data: RepresentativeFormValues) => {
    if (!firestore) return;

    // --- CRITICAL FIX: DUPLICATE CHECK ---
    // Check if code exists in the list (case insensitive)
    const codeExists = representatives.some(existingRep => {
      // If editing, skip checking against itself
      if (isEditMode && existingRep.id === representative.id) return false;
      
      return existingRep.code?.toLowerCase() === data.code.toLowerCase();
    });

    if (codeExists) {
      form.setError("code", { 
        type: "manual", 
        message: "Ce code existe déjà. Veuillez en choisir un autre." 
      });
      return; // STOP HERE. Do not save.
    }
    // -------------------------------------

    if (isEditMode && representative) {
      const representativeDocRef = doc(firestore, 'representatives', representative.id);
      updateDocumentNonBlocking(representativeDocRef, data);
      toast({
        title: 'Représentant modifié',
        description: `Le représentant "${data.name}" a été mis à jour.`,
      });
    } else {
      const representativesRef = collection(firestore, 'representatives');
      const docRef = await addDocumentNonBlocking(representativesRef, data);
      
      if (docRef) {
        toast({
            title: 'Représentant ajouté',
            description: `Le représentant "${data.name}" (${data.code}) a été ajouté avec succès.`,
        });
        onRepresentativeCreated?.({ ...data, id: docRef.id });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? 'Modifier le représentant' : 'Ajouter un représentant'}
              </DialogTitle>
              <DialogDescription>
                Remplissez les détails du représentant.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono" />
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
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="ex: jean.dupont@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                {isEditMode ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
