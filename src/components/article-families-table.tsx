'use client';

import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import type { ArticleFamily } from '@/lib/types';
import { api } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

type ArticleFamiliesTableProps = {
  families: ArticleFamily[];
  onEdit: (family: ArticleFamily) => void;
  onDeleteSuccess?: () => void;
  onAdd?: () => void;
};

export function ArticleFamiliesTable({ families, onEdit, onDeleteSuccess, onAdd }: ArticleFamiliesTableProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<ArticleFamily | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<ArticleFamily | null>(null);

  const handleDeleteRequest = (family: ArticleFamily) => {
    setFamilyToDelete(family);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!familyToDelete) return;

    try {
      await api.deleteArticleFamily(familyToDelete.id);

      toast({
        title: 'Famille supprimée',
        description: `La famille "${familyToDelete.name}" a été supprimée.`,
      });

      onDeleteSuccess?.();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e instanceof Error && e.message ? e.message : 'Une erreur est survenue lors de la suppression de la famille.',
      });
    }

    setDeleteDialogOpen(false);
    setFamilyToDelete(null);
    setSelectedFamily(null);
  };

  const handleSelectFamily = (family: ArticleFamily) => {
    if (selectedFamily?.id === family.id) {
      setSelectedFamily(null);
    } else {
      setSelectedFamily(family);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Toutes les familles</CardTitle>
          {selectedFamily && (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(selectedFamily)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                 <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteRequest(selectedFamily)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {families.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {families.map((family, index) => (
                  <TableRow
                    key={family.id}
                    onClick={() => handleSelectFamily(family)}
                    onDoubleClick={() => onEdit(family)}
                    className={cn('cursor-pointer', selectedFamily?.id === family.id && 'bg-muted/50')}
                  >
                    <TableCell className="font-medium">{family.code}</TableCell>
                    <TableCell>{family.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                    Vous n'avez pas encore de familles d'articles.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                    Commencez par en créer une.
                    </p>
                    {onAdd && (
                      <Button onClick={onAdd} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer une famille
                      </Button>
                    )}
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cette famille ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La famille "{familyToDelete?.name}" sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
