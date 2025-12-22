'use client';

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart';
import type { SalesData } from '@/lib/types';

type SalesTrendsChartProps = {
  data: SalesData[];
};

const chartConfig = {
  'This Year': {
    label: 'This Year',
    color: 'hsl(var(--primary))',
  },
  'Last Year': {
    label: 'Last Year',
    color: 'hsl(var(--secondary-foreground) / 0.5)',
  },
} satisfies ChartConfig;

export function SalesTrendsChart({ data }: SalesTrendsChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="This Year"
              stroke="var(--color-This Year)"
              strokeWidth={2}
              dot={true}
            />
            <Line
              type="monotone"
              dataKey="Last Year"
              stroke="var(--color-Last Year)"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
