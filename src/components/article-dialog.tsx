'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import type { Product as Article } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const articleSchema = z.object({
  code: z.string().min(1, "Le code de l'article est requis."),
  name: z.string().min(2, "Le nom de l'article doit contenir au moins 2 caractères."),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Le prix doit être un nombre positif.'),
  stockLevel: z.coerce.number().int().min(0, 'Le stock doit être un entier non négatif.'),
  reorderThreshold: z.coerce.number().int().min(0, 'Le seuil doit être un entier non négatif.'),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

type ArticleDialogProps = {
  isChild?: boolean;
  children?: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  article?: Article;
  lastArticleCodeNumber?: number;
  onArticleCreated?: (article: Article) => void;
};

export function ArticleDialog({ 
  isChild = false, 
  children,
  isOpen: openProp,
  onOpenChange: onOpenChangeProp,
  article,
  lastArticleCodeNumber = 0,
  onArticleCreated
 }: ArticleDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditMode = !!article;

  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const onOpenChange = onOpenChangeProp !== undefined ? onOpenChangeProp : setInternalOpen;


  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      price: 0,
      stockLevel: 0,
      reorderThreshold: 10,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && article) {
        form.reset({
            code: article.code,
            name: article.name,
            description: article.description,
            price: article.price,
            stockLevel: article.stockLevel,
            reorderThreshold: article.reorderThreshold,
        });
      } else {
        const nextCode = `ART${(lastArticleCodeNumber + 1).toString().padStart(3, '0')}`;
        form.reset({
          code: nextCode,
          name: '',
          description: '',
          price: 0,
          stockLevel: 0,
          reorderThreshold: 10,
        });
      }
    }
  }, [article, isEditMode, isOpen, form, lastArticleCodeNumber]);


  const onSubmit = async (data: ArticleFormValues) => {
    if (!firestore) return;

    const articleData = {
        code: data.code,
        name: data.name,
        description: data.description || '',
        price: data.price,
        stockLevel: data.stockLevel,
        reorderThreshold: data.reorderThreshold,
    };

    if (isEditMode && article) {
        const articleDocRef = doc(firestore, 'products', article.id);
        updateDocumentNonBlocking(articleDocRef, articleData);
        toast({
            title: 'Article modifié',
            description: `L'article "${data.name}" a été mis à jour.`,
        });
    } else {
        const articlesRef = collection(firestore, 'products');
        const docRef = await addDocumentNonBlocking(articlesRef, articleData);
        if (docRef) {
          onArticleCreated?.({ ...articleData, id: docRef.id });
        }
        toast({
          title: 'Article créé',
          description: `L'article "${data.name}" a été créé avec succès.`,
        });
    }

    onOpenChange(false);
  };

  const Trigger = isChild ? (
    <DialogTrigger asChild>{children}</DialogTrigger>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {Trigger}
      <DialogContent className="sm:max-w-[80vw]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Modifier l'article" : 'Ajouter un nouvel article'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? "Modifiez les informations de l'article." : "Remplissez les détails ci-dessous pour ajouter un nouvel article à votre inventaire."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code Article</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: ART001" {...field} />
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
                    <FormLabel>Nom de l'article</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Souris sans fil" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reorderThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seuil de stock bas</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Une brève description de l'article." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit">{isEditMode ? 'Enregistrer les modifications' : "Créer l'article"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
