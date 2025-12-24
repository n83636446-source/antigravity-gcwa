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
import type { ArticleFamily } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const familySchema = z.object({
  name: z.string().min(2, 'Le nom de la famille doit contenir au moins 2 caractères.'),
});

type FamilyFormValues = z.infer<typeof familySchema>;

type ArticleFamilyDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  family?: ArticleFamily;
};

export function ArticleFamilyDialog({ isOpen, onOpenChange, family }: ArticleFamilyDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!family;

  const form = useForm<FamilyFormValues>({
    resolver: zodResolver(familySchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && family) {
        form.reset({ name: family.name });
      } else {
        form.reset({ name: '' });
      }
    }
  }, [family, isEditMode, isOpen, form]);

  const onSubmit = (data: FamilyFormValues) => {
    if (!firestore) return;

    if (isEditMode && family) {
      const familyDocRef = doc(firestore, 'articleFamilies', family.id);
      updateDocumentNonBlocking(familyDocRef, data);
      toast({
        title: 'Famille modifiée',
        description: `La famille "${data.name}" a été mise à jour.`,
      });
    } else {
      const familiesRef = collection(firestore, 'articleFamilies');
      addDocumentNonBlocking(familiesRef, data);
      toast({
        title: 'Famille ajoutée',
        description: `La famille "${data.name}" a été ajoutée.`,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier la famille' : 'Ajouter une famille'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Modifiez le nom de la famille.' : 'Entrez le nom de la nouvelle famille.'}
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la famille</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Périphériques" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">{isEditMode ? 'Enregistrer' : 'Ajouter'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
