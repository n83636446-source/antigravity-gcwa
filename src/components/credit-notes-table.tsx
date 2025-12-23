'use client';

import type { CreditNote, Supplier } from '@/lib/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from './ui/badge';

type CreditNotesTableProps = {
  creditNotes: CreditNote[];
  suppliers: Supplier[];
};

export function CreditNotesTable({ creditNotes, suppliers }: CreditNotesTableProps) {
  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name ?? 'Inconnu';
  };

  const getStatusVariant = (status: CreditNote['status']) => {
    return status === 'Brouillon' ? 'secondary' : 'default';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avoirs récents</CardTitle>
      </CardHeader>
      <CardContent>
        {creditNotes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditNotes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="font-medium">
                    {note.creditNoteNumber}
                  </TableCell>
                  <TableCell>{getSupplierName(note.supplierId)}</TableCell>
                  <TableCell>
                    {format(new Date(note.creditNoteDate), 'dd/MM/yyyy', {
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(note.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(note.status)}>{note.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
           <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-48">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">
                Vous n'avez pas encore d'avoirs.
              </h3>
              <p className="text-sm text-muted-foreground">
                Commencez par en créer un.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
