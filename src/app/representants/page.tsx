'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { RepresentativeDialog } from '@/components/representative-dialog';
import { RepresentativesTable } from '@/components/representatives-table';
import type { Representative } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RepresentantsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRepresentative, setEditingRepresentative] = useState<
    Representative | undefined
  >();
  const [selectedRepresentative, setSelectedRepresentative] =
    useState<Representative | null>(null);

  const representativesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'representatives') : null),
    [firestore]
  );
  const { data: representatives, isLoading } =
    useCollection<Representative>(representativesRef);

  const handleAdd = () => {
    setEditingRepresentative(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (representative: Representative) => {
    setEditingRepresentative(representative);
    setDialogOpen(true);
  };

  const handleDelete = (representative: Representative) => {
    if (!firestore) return;
    const representativeDocRef = doc(firestore, 'representatives', representative.id);
    deleteDocumentNonBlocking(representativeDocRef);
    toast({
      title: 'Représentant supprimé',
      description: `Le représentant "${representative.name}" a été supprimé.`,
    });
    setSelectedRepresentative(null);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Représentants"
        description="Gérez votre liste de représentants."
      >
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un représentant
        </Button>
      </PageHeader>
      {isLoading ? (
         <Card>
          <CardHeader><CardTitle>Tous les représentants</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <RepresentativesTable
          representatives={representatives || []}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedRepresentative={selectedRepresentative}
          onSetSelectedRepresentative={setSelectedRepresentative}
        />
      )}
      <RepresentativeDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        representative={editingRepresentative}
        representatives={representatives || []}
      />
    </div>
  );
}
