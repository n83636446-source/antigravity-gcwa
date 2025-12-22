import type { Supplier, Product, SalesData } from './types';

export const suppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Global Electronics',
    contactName: 'John Doe',
    contactEmail: 'john.doe@globalelectronics.com',
    contactPhone: '123-456-7890',
  },
  {
    id: 'sup-2',
    name: 'Creative Office Supplies',
    contactName: 'Jane Smith',
    contactEmail: 'jane.smith@creativeoffice.com',
    contactPhone: '098-765-4321',
  },
  {
    id: 'sup-3',
    name: 'Home Goods Inc.',
    contactName: 'Peter Jones',
    contactEmail: 'peter.jones@homegoods.com',
    contactPhone: '111-222-3333',
  },
];

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with long battery life.',
    price: 25.99,
    stock: 150,
    lowStockThreshold: 20,
    supplierId: 'sup-1',
  },
  {
    id: 'prod-2',
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with blue switches.',
    price: 89.99,
    stock: 18,
    lowStockThreshold: 15,
    supplierId: 'sup-1',
  },
  {
    id: 'prod-3',
    name: 'Sticky Notes Set',
    description: 'Set of colorful sticky notes in various sizes.',
    price: 4.99,
    stock: 500,
    lowStockThreshold: 100,
    supplierId: 'sup-2',
  },
  {
    id: 'prod-4',
    name: 'A4 Paper Ream',
    description: '500 sheets of high-quality A4 printing paper.',
    price: 8.5,
    stock: 80,
    lowStockThreshold: 50,
    supplierId: 'sup-2',
  },
  {
    id: 'prod-5',
    name: 'Scented Candle',
    description: 'Large vanilla-scented candle in a glass jar.',
    price: 15.0,
    stock: 25,
    lowStockThreshold: 30,
    supplierId: 'sup-3',
  },
  {
    id: 'prod-6',
    name: 'Plush Throw Blanket',
    description: 'Soft and cozy plush blanket for your sofa.',
    price: 35.5,
    stock: 4,
    lowStockThreshold: 10,
    supplierId: 'sup-3',
  },
  {
    id: 'prod-7',
    name: 'USB-C Hub',
    description: '7-in-1 USB-C hub with HDMI, SD card reader, and USB-A ports.',
    price: 45.0,
    stock: 0,
    lowStockThreshold: 5,
    supplierId: 'sup-1',
  },
];

export const salesData: SalesData[] = [
  { month: 'Jan', 'This Year': 4000, 'Last Year': 2400 },
  { month: 'Feb', 'This Year': 3000, 'Last Year': 1398 },
  { month: 'Mar', 'This Year': 5000, 'Last Year': 4800 },
  { month: 'Apr', 'This Year': 4780, 'Last Year': 3908 },
  { month: 'May', 'This Year': 5890, 'Last Year': 4800 },
  { month: 'Jun', 'This Year': 4390, 'Last Year': 3800 },
  { month: 'Jul', 'This Year': 5490, 'Last Year': 4300 },
];
