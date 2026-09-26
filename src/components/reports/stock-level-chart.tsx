'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import type { Product } from '@/lib/types';
import { useMemo } from 'react';

type StockLevelChartProps = {
  data: Product[];
};

const chartConfig = {
  stockLevel: {
    label: 'Stock',
    color: 'hsl(var(--primary))',
  },
  reorderThreshold: {
    label: 'Seuil de stock bas',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

export function StockLevelChart({ data }: StockLevelChartProps) {
  const chartData = useMemo(() => {
    return data.map(product => ({
      name: product.name,
      stockLevel: (product.stockLevel || 0),
      reorderThreshold: product.reorderThreshold
    }));
  }, [data]);
  
  return (
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis />
            <Tooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="stockLevel" fill="var(--color-stockLevel)" radius={4} />
            <Bar dataKey="reorderThreshold" fill="var(--color-reorderThreshold)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
