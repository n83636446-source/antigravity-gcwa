'use client';

import { useMemo } from 'react';
import { collection, collectionGroup, query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Product, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ProductsTable } from '@/components/products-table';
import { ProductDialog } from '@/components/product-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductsPage() {
  const firestore = useFirestore();

  const suppliersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );

  const {
    data: suppliers,
    isLoading: isLoadingSuppliers,
  } = useCollection<Supplier>(suppliersRef);

  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'products')) : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } =
    useCollection<Product>(productsQuery);

  const isLoading = isLoadingSuppliers || isLoadingProducts;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Produits"
        description="Gérez votre inventaire de produits."
      >
        <ProductDialog suppliers={suppliers || []} />
      </PageHeader>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <ProductsTable products={products || []} suppliers={suppliers || []} />
      )}
    </div>
  );
}
