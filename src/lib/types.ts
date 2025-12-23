
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

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stockLevel: number;
  reorderThreshold: number;
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

export type PurchaseReceiptItem = {
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
};

export type PurchaseReceipt = {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  receiptDate: string; // ISO string
  notes?: string;
  items: PurchaseReceiptItem[];
};

export type PurchaseInvoice = {
  id: string;
  invoiceNumber: string;
  purchaseOrderId: string;
  invoiceDate: string; // ISO string
  dueDate: string; // ISO string
  totalAmount: number;
  status: 'Brouillon' | 'Non payée' | 'Payée' | 'En retard';
};

export type CreditNote = {
    id: string;
    creditNoteNumber: string;
    supplierId: string;
    creditNoteDate: string; // ISO string
    amount: number;
    reason: string;
    status: 'Brouillon' | 'Appliqué';
};

export type FirestoreEntity = Product | Supplier | Client | PurchaseOrder | PurchaseReceipt | PurchaseInvoice | CreditNote;
