import { PageHeader } from '@/components/page-header';
import { StockLevelChart } from '@/components/reports/stock-level-chart';
import { SalesTrendsChart } from '@/components/reports/sales-trends-chart';
import { products, salesData } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Reports & Analytics"
        description="Visualize your inventory and sales data."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trends</CardTitle>
            <CardDescription>
              Comparison of sales between this year and last year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendsChart data={salesData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stock Levels</CardTitle>
            <CardDescription>
              Current stock levels of all products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StockLevelChart data={products} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
