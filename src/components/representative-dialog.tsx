'use client';

import { useEffect } from 'react';
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
};

export function RepresentativeDialog({
  isOpen,
  onOpenChange,
  representative,
  onRepresentativeCreated,
}: RepresentativeDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!representative;

  const form = useForm<RepresentativeFormValues>({
    resolver: zodResolver(representativeSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && representative) {
        form.reset(representative);
      } else {
        form.reset({
          name: '',
          email: '',
        });
      }
    }
  }, [representative, isEditMode, isOpen, form]);

  const onSubmit = async (data: RepresentativeFormValues) => {
    if (!firestore) return;

    if (isEditMode && representative) {
      const representativeDocRef = doc(firestore, 'representatives', representative.id);
      updateDocumentNonBlocking(representativeDocRef, data);
      toast({
        title: 'Représentant modifié',
        description: `Le représentant "${data.name}" a été mis à jour.`,
      });
    } else {
      const representativesRef = collection(firestore, 'representatives');
      // We wait for the ID here to pass it back
      const docRef = await addDocumentNonBlocking(representativesRef, data);
      
      if (docRef) {
        toast({
            title: 'Représentant ajouté',
            description: `Le représentant "${data.name}" a été ajouté avec succès.`,
        });
        // Call the callback with the new ID
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
