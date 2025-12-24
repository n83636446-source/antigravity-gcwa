'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { ArticleFamily } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArticleFamiliesTable } from '@/components/article-families-table';
import { ArticleFamilyDialog } from '@/components/article-family-dialog';

export default function ArticleFamiliesPage() {
  const firestore = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ArticleFamily | undefined>();

  const familiesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'articleFamilies') : null),
    [firestore]
  );
  const { data: families, isLoading } = useCollection<ArticleFamily>(familiesRef);

  const handleAddFamily = () => {
    setEditingFamily(undefined);
    setIsDialogOpen(true);
  };

  const handleEditFamily = (family: ArticleFamily) => {
    setEditingFamily(family);
    setIsDialogOpen(true);
  };
  
  const lastFamilyCodeNumber = useMemo(() => {
    if (!families || families.length === 0) {
      return 0;
    }
    return families.reduce((max, s) => {
      const codeNumber = parseInt((s.code || 'FAM0').replace('FAM', ''), 10);
      return codeNumber > max ? codeNumber : max;
    }, 0);
  }, [families]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Familles d'articles"
        description="Gérez les catégories de vos articles."
      >
        <Button onClick={handleAddFamily}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter une famille
        </Button>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Toutes les familles</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <ArticleFamiliesTable families={families || []} onEdit={handleEditFamily} />
      )}

      <ArticleFamilyDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        family={editingFamily}
        lastFamilyCodeNumber={lastFamilyCodeNumber}
      />
    </div>
  );
}
