import { PageHeader } from '@/components/page-header';

export default function PurchaseOrdersPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Bons de commande"
        description="Gérez vos bons de commande."
      />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Vous n'avez pas encore de bons de commande.
          </h3>
          <p className="text-sm text-muted-foreground">
            Commencez par en créer un.
          </p>
        </div>
      </div>
    </div>
  );
}
