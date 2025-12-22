import type { Supplier, Product, SalesData, PurchaseOrder } from './types';

export const suppliers: Supplier[] = [];

export const products: Product[] = [];

export const salesData: SalesData[] = [
  { month: 'Jan', 'Cette Année': 4000, 'Année Dernière': 2400 },
  { month: 'Fév', 'Cette Année': 3000, 'Année Dernière': 1398 },
  { month: 'Mar', 'Cette Année': 5000, 'Année Dernière': 4800 },
  { month: 'Avr', 'Cette Année': 4780, 'Année Dernière': 3908 },
  { month: 'Mai', 'Cette Année': 5890, 'Année Dernière': 4800 },
  { month: 'Juin', 'Cette Année': 4390, 'Année Dernière': 3800 },
  { month: 'Juil', 'Cette Année': 5490, 'Année Dernière': 4300 },
];

export const purchaseOrders: PurchaseOrder[] = [];
