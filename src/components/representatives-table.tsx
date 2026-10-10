'use client';

import type { Representative } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type RepresentativesTableProps = {
  representatives: Representative[];
  onEdit: (representative: Representative) => void;
  onDelete: (representative: Representative) => void;
  selectedRepresentative: Representative | null;
  onSetSelectedRepresentative: (representative: Representative | null) => void;
};

export function RepresentativesTable({
  representatives,
  onEdit,
  onDelete,
  selectedRepresentative,
  onSetSelectedRepresentative,
}: RepresentativesTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [representativeToDelete, setRepresentativeToDelete] =
    useState<Representative | null>(null);

  const handleDeleteRequest = (representative: Representative) => {
    setRepresentativeToDelete(representative);
    setDeleteDialogOpen(true);
  };

  const handleSelectRepresentative = (representative: Representative) => {
    if (selectedRepresentative?.id === representative.id) {
      onSetSelectedRepresentative(null);
    } else {
      onSetSelectedRepresentative(representative);
    }
  };

  // --- THE FINAL FIX: FORCE DISPLAY ORDER HERE ---
  // Regardless of how the data comes in, we sort it strictly by Code (1, 2, 3...)
  // right before rendering.
  const sortedDisplayList = [...representatives].sort((a, b) => {
    // 1. Helper to turn "REP005" -> 5
    const getVal = (code?: string) => {
       if (!code) return 999999;
       // Strip non-digits
       const digits = String(code).replace(/\D/g, ''); 
       return digits ? parseInt(digits, 10) : 999999;
    };

    const valA = getVal(a.code);
    const valB = getVal(b.code);

    // 2. Sort Low to High
    return valA - valB;
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tous les représentants</CardTitle>
          {selectedRepresentative && (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(selectedRepresentative)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Modifier</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteRequest(selectedRepresentative)}
                  >
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
          {sortedDisplayList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Render the FORCE SORTED list */}
                {sortedDisplayList.map((representative) => (
                  <TableRow
                    key={representative.id}
                    onClick={() => handleSelectRepresentative(representative)}
                    onDoubleClick={() => onEdit(representative)}
                    className={cn(
                      'cursor-pointer',
                      selectedRepresentative?.id === representative.id && 'bg-muted/50'
                    )}
                  >
                    <TableCell className="font-mono text-muted-foreground">
                        {representative.code || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {representative.name}
                    </TableCell>
                    <TableCell>{representative.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
              <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-2xl font-bold tracking-tight">
                  Vous n'avez pas encore de représentants.
                </h3>
                <p className="text-sm text-muted-foreground">
                  Commencez par en créer un.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Êtes-vous sûr de vouloir supprimer ce représentant ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le représentant "
              {representativeToDelete?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (representativeToDelete) {
                  onDelete(representativeToDelete);
                }
                setDeleteDialogOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
