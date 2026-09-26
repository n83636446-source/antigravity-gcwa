'use server';

import {
  estimateStockLevel,
  type StockLevelEstimationInput,
} from '@/ai/flows/stock-level-estimation';
import { api } from '@/lib/api';

export async function runStockEstimation(
  productName: string,
  currentStockLevel: number,
  formData: FormData
) {
  try {
    const salesData = await api.getSalesData();
    const input: StockLevelEstimationInput = {
      historicalSalesData: JSON.stringify(salesData), // Using generic sales data for demo
      upcomingTrends: formData.get('upcomingTrends') as string,
      currentStockLevel: currentStockLevel,
      safetyStockLevel: Number(formData.get('safetyStockLevel')),
      leadTimeDays: Number(formData.get('leadTimeDays')),
    };

    const result = await estimateStockLevel(input);
    return { success: true, data: result };
  } catch (error) {
    console.error('AI estimation failed:', error);
    return { success: false, error: 'Failed to run stock estimation.' };
  }
}
