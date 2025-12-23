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
import { Textarea } from './ui/textarea';
import type { Client } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';

const clientSchema = z.object({
  name: z.string().min(2, 'Le nom du client doit contenir au moins 2 caractères.'),
  email: z.string().email('Veuillez saisir une adresse e-mail valide.'),
  phone: z.string().min(10, 'Veuillez saisir un numéro de téléphone valide.'),
  address: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

type ClientDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
};

export function ClientDialog({
  isOpen,
  onOpenChange,
  client,
}: ClientDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!client;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && client) {
        form.reset(client);
      } else {
        form.reset({
          name: '',
          email: '',
          phone: '',
          address: '',
        });
      }
    }
  }, [client, isEditMode, isOpen, form]);

  const onSubmit = (data: ClientFormValues) => {
    if (!firestore) return;

    if (isEditMode && client) {
      const clientDocRef = doc(firestore, 'clients', client.id);
      updateDocumentNonBlocking(clientDocRef, data);
      toast({
        title: 'Client modifié',
        description: `Le client "${data.name}" a été mis à jour.`,
      });
    } else {
      const clientsRef = collection(firestore, 'clients');
      addDocumentNonBlocking(clientsRef, data);
      toast({
        title: 'Client ajouté',
        description: `Le client "${data.name}" a été ajouté avec succès.`,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Modifier le client' : 'Ajouter un nouveau client'}</DialogTitle>
              <DialogDescription>
                Remplissez les détails du client.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du client</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Alice Martin" {...field} />
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
                    <Input type="email" placeholder="ex: alice.martin@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="ex: 06-12-34-56-78" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Adresse complète du client" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit">{isEditMode ? 'Enregistrer' : 'Ajouter le client'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
