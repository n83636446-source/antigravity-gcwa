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
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const clientSchema = z.object({
  name: z.string().min(2, 'Le nom du client doit contenir au moins 2 caractères.'),
  email: z.string().email('Veuillez saisir une adresse e-mail valide.'),
  phone: z.string().min(10, 'Veuillez saisir un numéro de téléphone valide.'),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export function ClientDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  });

  const onSubmit = (data: ClientFormValues) => {
    // In a real app, you would send this data to your API
    console.log(data);
    toast({
      title: 'Client ajouté',
      description: `Le client "${data.name}" a été ajouté avec succès.`,
    });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Ajouter un nouveau client</DialogTitle>
              <DialogDescription>
                Remplissez les détails du nouveau client.
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
            
            <DialogFooter>
              <Button type="submit">Ajouter le client</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
