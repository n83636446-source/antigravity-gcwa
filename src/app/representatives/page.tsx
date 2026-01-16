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
  // 1. Stocker les données brutes (non triées) de Firestore
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative | null>(null);
  const [representativeToEdit, setRepresentativeToEdit] = useState<Representative | undefined>(undefined);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  // 2. Récupérer les données brutes et les stocker dans l'état
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

  // 3. FORCER LE TRI AU RENDU (La solution à toute épreuve)
  // useMemo garantit que la liste est re-triée UNIQUEMENT lorsque les données brutes changent.
  // C'est la manière la plus efficace et la plus sûre de gérer le tri en React.
  const sortedRepresentatives = useMemo(() => {
    // Crée une copie pour ne pas muter l'état original
    const sorted = [...representatives];

    // Logique de tri
    sorted.sort((a, b) => {
      // Fonction d'aide pour extraire le poids numérique d'un code
      const getWeight = (r: Representative) => {
        if (!r.code) return Infinity; // Pas de code ? Tout en bas.
        
        // Extrait uniquement les chiffres
        const digits = String(r.code).replace(/[^0-9]/g, '');
        
        // Si aucun chiffre trouvé (ex: "TEST"), tout en bas.
        if (!digits) return Infinity;

        // Conversion en entier
        const val = parseInt(digits, 10);
        
        // Sécurité finale : si c'est NaN, tout en bas.
        return isNaN(val) ? Infinity : val;
      };

      const weightA = getWeight(a);
      const weightB = getWeight(b);

      // Critère de tri principal : par numéro (ordre croissant)
      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // Critère de tri secondaire (pour départager) : par nom, par ordre alphabétique
      // Empêche les éléments de sauter si leur poids numérique est identique
      return (a.name || "").localeCompare(b.name || "");
    });
    
    return sorted;
  }, [representatives]); // Ne s'exécute que si 'representatives' change

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

      {/* Le tableau reçoit maintenant la liste garantie d'être triée */}
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
          representatives={representatives} // La Dialog reçoit la liste brute pour calculer le prochain code
        />
      )}
    </div>
  );
}