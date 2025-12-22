'use client';

import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { SuppliersTable } from '@/components/suppliers-table';
import { SupplierDialog } from '@/components/supplier-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuppliersPage() {
  const firestore = useFirestore();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  
  const {
    data: suppliers,
    isLoading,
    error,
  } = useCollection<Supplier>(suppliersRef);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Fournisseurs"
        description="Gérez votre liste de fournisseurs."
      >
        <SupplierDialog />
      </PageHeader>
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {error && (
        <div className="text-red-500">
          Erreur lors du chargement des fournisseurs.
        </div>
      )}
      {!isLoading && !error && <SuppliersTable suppliers={suppliers || []} />}
    </div>
  );
}
