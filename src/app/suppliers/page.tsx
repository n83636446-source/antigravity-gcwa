import { PageHeader } from '@/components/page-header';
import { suppliers } from '@/lib/data';
import { SuppliersTable } from '@/components/suppliers-table';
import { SupplierDialog } from '@/components/supplier-dialog';

export default function SuppliersPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Suppliers"
        description="Manage your list of suppliers."
      >
        <SupplierDialog />
      </PageHeader>
      <SuppliersTable suppliers={suppliers} />
    </div>
  );
}
