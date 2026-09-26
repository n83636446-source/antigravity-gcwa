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
import { api } from '@/lib/api';

const familySchema = z.object({
  code: z.string().min(1, 'Le code de la famille est requis.'),
  name: z.string().min(2, 'Le nom de la famille doit contenir au moins 2 caractères.'),
});

type FamilyFormValues = z.infer<typeof familySchema>;

type ArticleFamilyDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  family?: ArticleFamily;
  lastFamilyCodeNumber?: number;
  families?: ArticleFamily[];
};

export function ArticleFamilyDialog({ isOpen, onOpenChange, family, lastFamilyCodeNumber = 0, families = [] }: ArticleFamilyDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!family;

  const form = useForm<FamilyFormValues>({
    resolver: zodResolver(familySchema),
    defaultValues: { code: '', name: '' },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && family) {
        form.reset({ code: family.code, name: family.name });
      } else {
        const nextCode = `FAM${(lastFamilyCodeNumber + 1).toString().padStart(3, '0')}`;
        form.reset({ code: nextCode, name: '' });
      }
    }
  }, [family, isEditMode, isOpen, form, lastFamilyCodeNumber]);

  const onSubmit = async (data: FamilyFormValues) => {
    const codeExists = families.some(
      f => f.code?.toLowerCase() === data.code.toLowerCase() && f.id !== family?.id
    );
    if (codeExists) {
      form.setError('code', { type: 'manual', message: 'Ce code de famille existe déjà.' });
      return;
    }

    try {
      if (isEditMode && family) {
        await api.updateArticleFamily(family.id, {
          code: data.code,
          name: data.name,
        });
        toast({
          title: 'Famille modifiée',
          description: `La famille "${data.name}" a été mise à jour.`,
        });
      } else {
        const newId = `fam-${Date.now()}`;
        await api.createArticleFamily({
          id: newId,
          code: data.code,
          name: data.name,
        });
        toast({
          title: 'Famille ajoutée',
          description: `La famille "${data.name}" a été ajoutée.`,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur est survenue lors de l\'enregistrement de la famille.',
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier la famille' : 'Ajouter une famille'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Modifiez les informations de la famille.' : 'Entrez les informations de la nouvelle famille.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: FAM001" {...field} />
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
                    <FormLabel>Nom de la famille</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Périphériques" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
