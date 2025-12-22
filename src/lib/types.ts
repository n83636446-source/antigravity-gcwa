export type Supplier = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  supplierId: string;
};

export type SalesData = {
  month: string;
  "Année Dernière": number;
  "Cette Année": number;
};

export type PurchaseOrderItem = {
  productId: string;
  quantity: number;
  price: number; // Price at the time of order
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  orderDate: string; // ISO string
  totalAmount: number;
  status: 'Brouillon' | 'Envoyé' | 'Reçu' | 'Annulé';
  items: PurchaseOrderItem[];
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
};
