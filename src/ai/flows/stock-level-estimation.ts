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
    .describe('Données de ventes historiques pour le produit, sous forme de chaîne JSON.'),
  upcomingTrends: z
    .string()
    .describe("Informations sur les tendances à venir qui pourraient affecter les ventes, sous forme de description textuelle."),
  currentStockLevel: z
    .number()
    .describe('Le niveau de stock actuel du produit.'),
  safetyStockLevel: z
    .number()
    .describe('Le niveau de stock de sécurité souhaité pour le produit.'),
  leadTimeDays: z
    .number()
    .describe('Le délai en jours pour le réapprovisionnement du produit.'),
});
export type StockLevelEstimationInput = z.infer<typeof StockLevelEstimationInputSchema>;

const StockLevelEstimationOutputSchema = z.object({
  estimatedNeed: z
    .number()
    .describe('Le besoin estimé pour le produit sur la prochaine période de délai.'),
  suggestedOrderQuantity: z
    .number()
    .describe("La quantité de commande suggérée pour répondre au besoin estimé et maintenir le stock de sécurité."),
  reasoning: z
    .string()
    .describe('Le raisonnement derrière la quantité de commande suggérée.'),
});
export type StockLevelEstimationOutput = z.infer<typeof StockLevelEstimationOutputSchema>;

export async function estimateStockLevel(input: StockLevelEstimationInput): Promise<StockLevelEstimationOutput> {
  return stockLevelEstimationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'stockLevelEstimationPrompt',
  input: {schema: StockLevelEstimationInputSchema},
  output: {schema: StockLevelEstimationOutputSchema},
  prompt: `Vous êtes un gestionnaire de stock expert. Vous utiliserez les données de ventes historiques, les tendances à venir, le niveau de stock actuel, le niveau de stock de sécurité et le délai pour estimer le besoin d'un produit et suggérer une quantité de commande.

Données de ventes historiques: {{{historicalSalesData}}}
Tendances à venir: {{{upcomingTrends}}}
Niveau de stock actuel: {{{currentStockLevel}}}
Niveau de stock de sécurité: {{{safetyStockLevel}}}
Délai (Jours): {{{leadTimeDays}}}

Examinez attentivement tous les facteurs et fournissez une suggestion bien argumentée pour la quantité de commande.

Sortie au format JSON:
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
