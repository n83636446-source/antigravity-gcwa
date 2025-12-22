import { PageHeader } from '@/components/page-header';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { InventoryTable } from '@/components/dashboard/inventory-table';
import { products, suppliers } from '@/lib/data';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Tableau de bord"
        description="Un aperçu de votre inventaire et de vos niveaux de stock."
      />
      <StatsCards products={products} />
      <InventoryTable products={products} suppliers={suppliers} />
    </div>
  );
}
