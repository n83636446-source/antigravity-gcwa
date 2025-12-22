'use server';

/**
 * @fileOverview Estimates stock levels based on historical sales data and upcoming trends.
 *
 * - estimateStockLevel - A function that estimates the stock level.
 * - StockLevelEstimationInput - The input type for the estimateStockLevel function.
 * - StockLevelEstimationOutput - The return type for the estimateStockLevel function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StockLevelEstimationInputSchema = z.object({
  historicalSalesData: z
    .string()
    .describe('Historical sales data for the product, as a JSON string.'),
  upcomingTrends: z
    .string()
    .describe('Information about upcoming trends that may affect sales, as a text description.'),
  currentStockLevel: z
    .number()
    .describe('The current stock level of the product.'),
  safetyStockLevel: z
    .number()
    .describe('The desired safety stock level for the product.'),
  leadTimeDays: z
    .number()
    .describe('The lead time in days for restocking the product.'),
});
export type StockLevelEstimationInput = z.infer<typeof StockLevelEstimationInputSchema>;

const StockLevelEstimationOutputSchema = z.object({
  estimatedNeed: z
    .number()
    .describe('The estimated need for the product over the next lead time period.'),
  suggestedOrderQuantity: z
    .number()
    .describe('The suggested order quantity to meet the estimated need and maintain safety stock.'),
  reasoning: z
    .string()
    .describe('The reasoning behind the suggested order quantity.'),
});
export type StockLevelEstimationOutput = z.infer<typeof StockLevelEstimationOutputSchema>;

export async function estimateStockLevel(input: StockLevelEstimationInput): Promise<StockLevelEstimationOutput> {
  return stockLevelEstimationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'stockLevelEstimationPrompt',
  input: {schema: StockLevelEstimationInputSchema},
  output: {schema: StockLevelEstimationOutputSchema},
  prompt: `You are an expert stock manager.  You will use historical sales data, upcoming trends, current stock level, safety stock level, and lead time to estimate the need for a product and suggest an order quantity.

Historical Sales Data: {{{historicalSalesData}}}
Upcoming Trends: {{{upcomingTrends}}}
Current Stock Level: {{{currentStockLevel}}}
Safety Stock Level: {{{safetyStockLevel}}}
Lead Time (Days): {{{leadTimeDays}}}

Consider all factors carefully and provide a well-reasoned suggestion for the order quantity.

Output in JSON format:
`,
});

const stockLevelEstimationFlow = ai.defineFlow(
  {
    name: 'stockLevelEstimationFlow',
    inputSchema: StockLevelEstimationInputSchema,
    outputSchema: StockLevelEstimationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
