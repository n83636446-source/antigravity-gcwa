import { PageHeader } from '@/components/page-header';
import { products, suppliers } from '@/lib/data';
import { ProductsTable } from '@/components/products-table';
import { ProductDialog } from '@/components/product-dialog';

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Products"
        description="Manage your product inventory."
      >
        <ProductDialog suppliers={suppliers} />
      </PageHeader>
      <ProductsTable products={products} suppliers={suppliers} />
    </div>
  );
}
