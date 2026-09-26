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
import { api } from '@/lib/api';

const representativeSchema = z.object({
  code: z.string().optional(),
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
    
    const maxId = representatives.reduce((max, rep) => {
      if (!(rep as any).code) return max;
      const digits = String((rep as any).code).replace(/\D/g, '');
      const num = digits ? parseInt(digits, 10) : 0;
      return num > max ? num : max;
    }, 0);

    return `REP${(maxId + 1).toString().padStart(3, '0')}`;
  }, [representatives]);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && representative) {
        form.reset({
            code: (representative as any).code || '',
            name: representative.name,
            email: representative.email || '',
        });
      } else {
        form.reset({
          code: nextCode,
          name: '',
          email: '',
        });
      }
    }
  }, [isOpen, isEditMode, representative, nextCode, form]);

  const onSubmit = async (data: RepresentativeFormValues) => {
    // Check Email
    const codeExists = representatives.some(existingRep => {
      if (isEditMode && existingRep.id === representative?.id) return false;
      if (!data.code || !(existingRep as any).code) return false;
      return (existingRep as any).code.toLowerCase() === data.code.toLowerCase();
    });

    if (codeExists) {
      form.setError("code", { 
        type: "manual", 
        message: "Ce code est déjà utilisé par un autre représentant." 
      });
      return; 
    }

    const emailExists = representatives.some(existingRep => {
      if (isEditMode && existingRep.id === representative?.id) return false;
      if (!data.email || !existingRep.email) return false;
      return existingRep.email.toLowerCase() === data.email.toLowerCase();
    });

    if (emailExists) {
      form.setError("email", { 
        type: "manual", 
        message: "Cette adresse email est déjà utilisée par un autre représentant." 
      });
      return; 
    }

    try {
      if (isEditMode && representative) {
        await api.updateRepresentative(representative.id, {
          name: data.name,
          email: data.email || null,
          code: data.code || null,
        });
        toast({
          title: 'Représentant modifié',
          description: `Le représentant "${data.name}" a été mis à jour.`,
        });
        onRepresentativeCreated?.({ ...representative, name: data.name, email: data.email, code: data.code });
      } else {
        const newId = `rep-${Date.now()}`;
        const created = await api.createRepresentative({
          id: newId,
          name: data.name,
          email: data.email || null,
          code: data.code || null,
        });
        toast({
          title: 'Représentant ajouté',
          description: `Le représentant "${data.name}" a été ajouté avec succès.`,
        });
        onRepresentativeCreated?.({ id: created.id, name: created.name, email: created.email ?? undefined });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur est survenue lors de l\'enregistrement du représentant.',
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* --- VISUAL UPDATE: HEADER SEPARATOR --- */}
            <DialogHeader className="border-b pb-4 mb-4">
              <DialogTitle>
                {isEditMode ? 'Modifier le représentant' : 'Ajouter un représentant'}
              </DialogTitle>
              <DialogDescription>
                Remplissez les détails du représentant.
              </DialogDescription>
            </DialogHeader>
            {/* --------------------------------------- */}

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
