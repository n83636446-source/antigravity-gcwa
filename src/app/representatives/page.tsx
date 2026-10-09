'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { RepresentativesTable } from '@/components/representatives-table';
import { RepresentativeDialog } from '@/components/representative-dialog';
import { Representative, representativeFromApi } from '@/lib/types';
import { useApiCollection } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function RepresentativesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative | null>(null);
  const [representativeToEdit, setRepresentativeToEdit] = useState<Representative | undefined>(undefined);
  const { toast } = useToast();

  const fetchRepresentatives = useCallback(() => api.getRepresentatives(), []);
  const { data: rawReps, refetch } = useApiCollection(fetchRepresentatives);
  const representatives: Representative[] = useMemo(() => (rawReps || []).map(representativeFromApi), [rawReps]);

  useEffect(() => {
    if (selectedRepresentative) {
      const updated = representatives.find(r => r.id === selectedRepresentative.id);
      if (updated && updated !== selectedRepresentative) {
        setSelectedRepresentative(updated);
      }
    }
  }, [representatives, selectedRepresentative]);
  const sortedRepresentatives = useMemo(() => {
    const sorted = [...representatives];
    sorted.sort((a, b) => {
      const getWeight = (r: Representative) => {
        if (!r.code) return Infinity;
        const digits = String(r.code).replace(/[^0-9]/g, '');
        if (!digits) return Infinity;
        const val = parseInt(digits, 10);
        return isNaN(val) ? Infinity : val;
      };
      const weightA = getWeight(a);
      const weightB = getWeight(b);
      if (weightA !== weightB) return weightA - weightB;
      return (a.name || '').localeCompare(b.name || '');
    });
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
    try {
      await api.deleteRepresentative(representative.id);
      toast({
        title: 'Représentant supprimé',
        description: `Le représentant ${representative.name} a été supprimé.`,
      });
      refetch();
      setSelectedRepresentative(null);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error && e.message ? e.message : 'Une erreur est survenue lors de la suppression.',
        variant: 'destructive',
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
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) refetch();
          }}
          representative={representativeToEdit}
          representatives={representatives}
        />
      )}
    </div>
  );
}