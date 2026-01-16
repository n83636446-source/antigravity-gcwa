'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { RepresentativesTable } from '@/components/representatives-table';
import { RepresentativeDialog } from '@/components/representative-dialog';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import type { Representative } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function RepresentativesPage() {
  // Store raw data
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
      const reps = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Representative[];
      
      setRepresentatives(reps);
    });

    return () => unsubscribe();
  }, [firestore]);

  // THE BULLETPROOF SORT
  const sortedRepresentatives = useMemo(() => {
    // 1. Create a copy so we don't mutate state
    const sorted = [...representatives];

    // 2. Sort Logic
    sorted.sort((a, b) => {
      // Helper: Turn "REP005" -> 5. Turn null -> 999999.
      const getWeight = (item: Representative) => {
        if (!item.code) return 999999; // No code? Put at bottom.
        
        // Convert to string safely (handles numbers/nulls)
        const str = String(item.code);
        
        // Remove everything that is NOT a number (e.g. "REP" or "-" or spaces)
        const cleanStr = str.replace(/[^0-9]/g, '');
        
        // If string was just text like "TEST", cleanStr is empty. Return huge number.
        if (cleanStr === '') return 999999;

        // Parse to integer
        return parseInt(cleanStr, 10);
      };

      const weightA = getWeight(a);
      const weightB = getWeight(b);

      // Compare: Low Numbers (1) to High Numbers (5)
      return weightA - weightB;
    });

    // 3. DEBUG: Log the order to Console (Press F12 to check)
    // This will show you exactly what order the computer thinks they are in.
    if (sorted.length > 0) {
        console.groupCollapsed("Representative Sort Debug");
        console.table(sorted.map(r => ({ 
            Code: r.code, 
            "Calculated Weight": parseInt(String(r.code || "").replace(/[^0-9]/g, '') || "999999") 
        })));
        console.groupEnd();
    }

    return sorted;
  }, [representatives]);

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
          representatives={representatives}
        />
      )}
    </div>
  );
}
