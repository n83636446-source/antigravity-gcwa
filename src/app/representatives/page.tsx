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
  // 1. Store Raw Data (Unsorted)
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative | null>(null);
  const [representativeToEdit, setRepresentativeToEdit] = useState<Representative | undefined>(undefined);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  // 2. Fetch Data (Just store it, don't sort it here)
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

  // 3. FORCE SORT ON RENDER (The Bulletproof Fix)
  // This runs every time the page renders, ensuring the list sent to the table 
  // is ALWAYS sorted numerically (1, 2, 3...).
  const sortedRepresentatives = useMemo(() => {
    return [...representatives].sort((a, b) => {
        // Extract number safely (e.g. "REP005" -> 5)
        // If code is missing, treat as Infinity to push to bottom
        const getNum = (code?: string) => {
            if (!code) return 999999999;
            const match = code.match(/(\d+)/);
            return match ? parseInt(match[0], 10) : 999999999;
        };

        const numA = getNum(a.code);
        const numB = getNum(b.code);

        // A - B = Ascending (1, 2, 3...)
        return numA - numB;
    });
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

      {/* PASS THE SORTED LIST HERE */}
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
          representatives={representatives} // Pass raw list for calc
        />
      )}
    </div>
  );
}
