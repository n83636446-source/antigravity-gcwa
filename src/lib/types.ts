'use client';

export type Supplier = {
  id: string;
  name: string;
  code: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  street: string;
  city: string;
  country: string;
  ice: string;
};

export type ArticleFamily = {
  id: string;
  code: string;
  name: string;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  stockLevel: number;
  reorderThreshold: number;
  familyId?: string;
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
  tvaRate: number;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  orderDate: string; // ISO string
  items: PurchaseOrderItem[];
  totalHT: number;
  totalTTC: number;
  paymentMode?: string;
  dueDate?: string;
  representativeId?: string;
  reference?: string;
  remarks?: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
};

export type PurchaseReceiptItem = {
  productId: string;
  quantityOrdered?: number; // Now optional
  quantityReceived: number;
  price: number;
  tvaRate: number;
};

export type PurchaseReceipt = {
  id: string;
  receiptNumber: string;
  purchaseOrderId?: string; // Made optional
  supplierId: string; // Added to directly link to supplier
  receiptDate: string; // ISO string
  items: PurchaseReceiptItem[];
  status: 'Brouillon' | 'Validé';
  totalHT: number;
  totalTTC: number;
  paymentMode?: string;
  dueDate?: string;
  representativeId?: string;
  reference?: string;
  remarks?: string;
};

export type PurchaseInvoiceItem = {
    productId: string;
    quantity: number;
    price: number;
    tvaRate: number;
};

export type PurchaseInvoice = {
  id: string;
  invoiceNumber: string;
  purchaseOrderId?: string; // Made optional
  supplierId: string; // Added to directly link to supplier
  items: PurchaseInvoiceItem[]; // Added items
  invoiceDate: string; // ISO string
  status: 'Brouillon' | 'Non payée' | 'Payée' | 'En retard';
  totalHT: number;
  totalTTC: number;
  paymentMode?: string;
  dueDate?: string;
  representativeId?: string;
  reference?: string;
  remarks?: string;
};

export type CreditNoteItem = {
  productId: string;
  quantity: number;
  price: number;
  tvaRate: number;
};

export type CreditNote = {
    id: string;
    creditNoteNumber: string;
    supplierId: string;
    creditNoteDate: string; // ISO string
    reason: string;
    status: 'Brouillon' | 'Appliqué';
    items: CreditNoteItem[];
    totalHT: number;
    totalTTC: number;
    paymentMode?: string;
    dueDate?: string;
    representativeId?: string;
    reference?: string;
    remarks?: string;
};

export type Representative = {
    id: string;
    name: string;
    email: string;
};

export type FirestoreEntity = Product | Supplier | Client | PurchaseOrder | PurchaseReceipt | PurchaseInvoice | CreditNote | ArticleFamily | Representative;
