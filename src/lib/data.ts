import type { Supplier, Product, SalesData } from './types';

export const suppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Électronique Mondiale',
    contactName: 'Jean Dupont',
    contactEmail: 'jean.dupont@electroniquemondiale.com',
    contactPhone: '01-23-45-67-89',
  },
  {
    id: 'sup-2',
    name: 'Fournitures de Bureau Créatives',
    contactName: 'Jeanne Martin',
    contactEmail: 'jeanne.martin@fbc.com',
    contactPhone: '09-87-65-43-21',
  },
  {
    id: 'sup-3',
    name: 'Articles pour la Maison SA',
    contactName: 'Pierre Petit',
    contactEmail: 'pierre.petit@articlesmaison.com',
    contactPhone: '01-11-22-33-44',
  },
];

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'Souris sans fil',
    description: 'Souris sans fil ergonomique avec une longue autonomie.',
    price: 25.99,
    stock: 150,
    lowStockThreshold: 20,
    supplierId: 'sup-1',
  },
  {
    id: 'prod-2',
    name: 'Clavier mécanique',
    description: 'Clavier mécanique RVB avec des switchs bleus.',
    price: 89.99,
    stock: 18,
    lowStockThreshold: 15,
    supplierId: 'sup-1',
  },
  {
    id: 'prod-3',
    name: 'Ensemble de notes autocollantes',
    description: 'Ensemble de notes autocollantes colorées de différentes tailles.',
    price: 4.99,
    stock: 500,
    lowStockThreshold: 100,
    supplierId: 'sup-2',
  },
  {
    id: 'prod-4',
    name: 'Ramette de papier A4',
    description: '500 feuilles de papier d\'impression A4 de haute qualité.',
    price: 8.5,
    stock: 80,
    lowStockThreshold: 50,
    supplierId: 'sup-2',
  },
  {
    id: 'prod-5',
    name: 'Bougie parfumée',
    description: 'Grande bougie parfumée à la vanille dans un bocal en verre.',
    price: 15.0,
    stock: 25,
    lowStockThreshold: 30,
    supplierId: 'sup-3',
  },
  {
    id: 'prod-6',
    name: 'Plaid douillet',
    description: 'Couverture douce et confortable pour votre canapé.',
    price: 35.5,
    stock: 4,
    lowStockThreshold: 10,
    supplierId: 'sup-3',
  },
  {
    id: 'prod-7',
    name: 'Hub USB-C',
    description: 'Hub USB-C 7-en-1 avec HDMI, lecteur de carte SD et ports USB-A.',
    price: 45.0,
    stock: 0,
    lowStockThreshold: 5,
    supplierId: 'sup-1',
  },
];

export const salesData: SalesData[] = [
  { month: 'Jan', 'Cette Année': 4000, 'Année Dernière': 2400 },
  { month: 'Fév', 'Cette Année': 3000, 'Année Dernière': 1398 },
  { month: 'Mar', 'Cette Année': 5000, 'Année Dernière': 4800 },
  { month: 'Avr', 'Cette Année': 4780, 'Année Dernière': 3908 },
  { month: 'Mai', 'Cette Année': 5890, 'Année Dernière': 4800 },
  { month: 'Juin', 'Cette Année': 4390, 'Année Dernière': 3800 },
  { month: 'Juil', 'Cette Année': 5490, 'Année Dernière': 4300 },
];
