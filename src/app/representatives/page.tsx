'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { RepresentativesTable } from '@/components/representatives-table';
import { RepresentativeDialog } from '@/components/representative-dialog';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import type { Representative } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function RepresentativesPage() {
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative | null>(null);
  const [representativeToEdit, setRepresentativeToEdit] = useState<Representative | undefined>(undefined);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;

    const q = query(collection(firestore, 'representatives'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawReps = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Representative[];

      // STEP 1: Calculate the sort value for every item properly
      const mapped = rawReps.map((rep, index) => {
        let sortValue = 999999; // Default to bottom if no code
        
        if (rep.code) {
          // Remove all non-digits (e.g. "REP-005" -> "005")
          const numbersOnly = rep.code.replace(/\D/g, '');
          if (numbersOnly.length > 0) {
            sortValue = parseInt(numbersOnly, 10);
          }
        }
        return { index, value: sortValue, data: rep };
      });

      // STEP 2: Sort the mapped array strictly by the number
      mapped.sort((a, b) => {
        return a.value - b.value;
      });

      // STEP 3: Extract the sorted data
      const finalSorted = mapped.map((el) => el.data);

      console.log("Sort Order Debug:", finalSorted.map(r => `${r.code} (${r.name})`));
      setRepresentatives(finalSorted);
    });

    return () => unsubscribe();
  }, [firestore]);

  const handleCreate = () => {
    setRepresentativeToEdit(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (representative: Representative) => {
    setRepresentativeToEdit(representative);
    setIsDialogOpen(true);
  };

  const handleDelete = async (representative: Representative) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'representatives', representative.id));
      toast({
        title: 'Représentant supprimé',
        description: `Le représentant ${representative.name} a été supprimé.`,
      });
      setSelectedRepresentative(null);
    } catch (error) {
      console.error("Error deleting representative:", error);
      toast({
        title: 'Erreur',
        description: "Une erreur est survenue lors de la suppression.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Représentants</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau représentant
        </Button>
      </div>

      <RepresentativesTable
        representatives={representatives}
        onEdit={handleEdit}
        onDelete={handleDelete}
        selectedRepresentative={selectedRepresentative}
        onSetSelectedRepresentative={setSelectedRepresentative}
      />

      {isDialogOpen && (
        <RepresentativeDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          representative={representativeToEdit}
          representatives={representatives}
        />
      )}
    </div>
  );
}
