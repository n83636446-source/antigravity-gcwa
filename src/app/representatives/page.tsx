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
  const [rawRepresentatives, setRawRepresentatives] = useState<Representative[]>([]);
  const [sortedRepresentatives, setSortedRepresentatives] = useState<Representative[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative | null>(null);
  const [representativeToEdit, setRepresentativeToEdit] = useState<Representative | undefined>(undefined);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  // 1. FETCH RAW DATA
  useEffect(() => {
    if (!firestore) return;

    const q = query(collection(firestore, 'representatives'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reps = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Representative[];
      
      setRawRepresentatives(reps);
    });

    return () => unsubscribe();
  }, [firestore]);

  // 2. PROCESS & SORT (Runs whenever raw data changes)
  useEffect(() => {
    const sorted = [...rawRepresentatives].sort((a, b) => {
      const getVal = (r: Representative) => {
        if (!r.code) return 999999;
        
        // Convert to string and strip non-digits
        const digits = String(r.code).replace(/\D/g, '');
        
        // If empty string (e.g. "TEST"), return huge number
        if (!digits) return 999999;
        
        return parseInt(digits, 10);
      };

      const valA = getVal(a);
      const valB = getVal(b);

      return valA - valB; // Ascending: 1, 2, 3...
    });

    // Debugging: Check the browser console to see the calculated order
    console.log("Sort Debug:", sorted.map(r => `${r.code} (${String(r.code).replace(/\D/g, '')})`));

    setSortedRepresentatives(sorted);
  }, [rawRepresentatives]);

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
        representatives={sortedRepresentatives}
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
          representatives={sortedRepresentatives} // Pass sorted list for accurate calculation
        />
      )}
    </div>
  );
}
