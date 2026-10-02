/**
 * API client for the StockPilot FastAPI backend.
 * All data fetching and persistence goes through here.
 */

import { reglementFromApi } from '@/lib/types';
import type { Reglement } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export type ApiSalesData = {
  month: string;
  this_year: number;
  last_year: number;
};

export type ApiArticleFamily = {
  id: string;
  code: string;
  name: string;
};

export type ApiSupplier = {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  ice: string | null;
};

export type ApiProduct = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  stock_level: number;
  reorder_threshold: number;
  family_id: string | null;
  supplier_id: string | null;
};

export type ApiClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type ApiRepresentative = {
  id: string;
  name: string;
  email: string | null;
  code?: string | null;
};

export type ApiPurchaseOrderItem = {
  productId: string;
  quantity: number;
  price: number;
  tvaRate: number;
};

export type ApiPurchaseOrder = {
  id: string;
  order_number: string;
  supplier_id: string;
  order_date: string;
  items: ApiPurchaseOrderItem[];
  status: 'Brouillon' | 'Validé';
  total_ht: number;
  total_ttc: number;
  payment_mode?: string | null;
  delivery_date?: string | null;
  supplier_order_ref?: string | null;
  representative_id?: string | null;
  reference?: string | null;
  remarks?: string | null;
};

export type ApiPurchaseReceiptItem = {
  productId: string;
  quantityOrdered?: number;
  quantityReceived: number;
  price: number;
  tvaRate: number;
};

export type ApiPurchaseReceipt = {
  id: string;
  receipt_number: string;
  purchase_order_id?: string | null;
  supplier_id: string;
  receipt_date: string;
  status: 'Brouillon' | 'Validé';
  items: ApiPurchaseReceiptItem[];
  total_ht: number;
  total_ttc: number;
  payment_mode?: string | null;
  due_date?: string | null;
  representative_id?: string | null;
  reference?: string | null;
  remarks?: string | null;
};

export type ApiPurchaseInvoiceItem = {
  productId: string;
  quantity: number;
  price: number;
  tvaRate: number;
};

export type ApiPurchaseInvoice = {
  id: string;
  invoice_number: string;
  purchase_order_id?: string | null;
  supplier_id: string;
  invoice_date: string;
  status: 'Brouillon' | 'Non payée' | 'Payée' | 'En retard' | 'Partiellement payée';
  items: ApiPurchaseInvoiceItem[];
  total_ht: number;
  total_ttc: number;
  amount_paid?: number | null;
  payment_mode?: string | null;
  due_date?: string | null;
  representative_id?: string | null;
  reference?: string | null;
  remarks?: string | null;
};

export type ApiPurchaseCreditNoteItem = {
  productId: string;
  quantity: number;
  price: number;
  tvaRate: number;
};

export type ApiPurchaseCreditNote = {
  id: string;
  credit_note_number: string;
  purchase_invoice_id?: string | null;
  supplier_id: string;
  credit_note_date: string;
  status: 'Brouillon' | 'Validé';
  items: ApiPurchaseCreditNoteItem[];
  total_ht: number;
  total_ttc: number;
  payment_mode?: string | null;
  due_date?: string | null;
  representative_id?: string | null;
  reference?: string | null;
  remarks?: string | null;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    let detail = `API error ${res.status} on ${path}`;
    try {
      const errBody = await res.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // response wasn't valid JSON, keep the generic message
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `API POST error ${res.status} on ${path}`;
    try {
      const errBody = await res.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // response wasn't valid JSON, keep the generic message
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `API PUT error ${res.status} on ${path}`;
    try {
      const errBody = await res.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // response wasn't valid JSON, keep the generic message
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    let detail = `API DELETE error ${res.status} on ${path}`;
    try {
      const errBody = await res.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // response wasn't valid JSON, keep the generic message
    }
    throw new Error(detail);
  }
}

export const api = {
  // Article Families
  getArticleFamilies: () => get<ApiArticleFamily[]>('/article_families'),
  createArticleFamily: (data: ApiArticleFamily) => post<ApiArticleFamily>('/article_families', data),
  updateArticleFamily: (id: string, data: Partial<ApiArticleFamily>) => put<ApiArticleFamily>(`/article_families/${id}`, data),
  deleteArticleFamily: (id: string) => del(`/article_families/${id}`),

  // Suppliers
  getSuppliers: () => get<ApiSupplier[]>('/suppliers'),
  createSupplier: (data: ApiSupplier) => post<ApiSupplier>('/suppliers', data),
  updateSupplier: (id: string, data: Partial<ApiSupplier>) => put<ApiSupplier>(`/suppliers/${id}`, data),
  deleteSupplier: (id: string) => del(`/suppliers/${id}`),

  // Products
  getProducts: () => get<ApiProduct[]>('/products'),
  createProduct: (data: ApiProduct) => post<ApiProduct>('/products', data),
  updateProduct: (id: string, data: Partial<ApiProduct>) => put<ApiProduct>(`/products/${id}`, data),
  deleteProduct: (id: string) => del(`/products/${id}`),

  // Clients
  getClients: () => get<ApiClient[]>('/clients'),
  createClient: (data: ApiClient) => post<ApiClient>('/clients', data),
  updateClient: (id: string, data: Partial<ApiClient>) => put<ApiClient>(`/clients/${id}`, data),
  deleteClient: (id: string) => del(`/clients/${id}`),

  // Representatives
  getRepresentatives: () => get<ApiRepresentative[]>('/representatives'),
  createRepresentative: (data: ApiRepresentative) => post<ApiRepresentative>('/representatives', data),
  updateRepresentative: (id: string, data: Partial<ApiRepresentative>) => put<ApiRepresentative>(`/representatives/${id}`, data),
  deleteRepresentative: (id: string) => del(`/representatives/${id}`),

  // Sales Data
  getSalesData: () => get<ApiSalesData[]>('/sales_data'),

  // Purchase Orders
  getPurchaseOrders: () => get<ApiPurchaseOrder[]>('/purchase_orders'),
  createPurchaseOrder: (data: ApiPurchaseOrder) => post<ApiPurchaseOrder>('/purchase_orders', data),
  updatePurchaseOrder: (id: string, data: Partial<ApiPurchaseOrder>) => put<ApiPurchaseOrder>(`/purchase_orders/${id}`, data),
  deletePurchaseOrder: (id: string) => del(`/purchase_orders/${id}`),

  // Purchase Receipts
  getPurchaseReceipts: () => get<ApiPurchaseReceipt[]>('/purchase_receipts'),
  createPurchaseReceipt: (data: ApiPurchaseReceipt) => post<ApiPurchaseReceipt>('/purchase_receipts', data),
  updatePurchaseReceipt: (id: string, data: Partial<ApiPurchaseReceipt>) => put<ApiPurchaseReceipt>(`/purchase_receipts/${id}`, data),
  validatePurchaseReceipt: (id: string) => post<ApiPurchaseReceipt>(`/purchase_receipts/${id}/validate`, {}),
  cancelPurchaseReceiptValidation: (id: string) => post<ApiPurchaseReceipt>(`/purchase_receipts/${id}/cancel-validation`, {}),
  deletePurchaseReceipt: (id: string) => del(`/purchase_receipts/${id}`),

  // Purchase Invoices
  getPurchaseInvoices: () => get<ApiPurchaseInvoice[]>('/purchase_invoices'),
  createPurchaseInvoice: (data: ApiPurchaseInvoice) => post<ApiPurchaseInvoice>('/purchase_invoices', data),
  updatePurchaseInvoice: (id: string, data: Partial<ApiPurchaseInvoice>) => put<ApiPurchaseInvoice>(`/purchase_invoices/${id}`, data),
  validatePurchaseInvoice: (id: string) => post<ApiPurchaseInvoice>(`/purchase_invoices/${id}/validate`, {}),
  cancelPurchaseInvoiceValidation: (id: string) => post<ApiPurchaseInvoice>(`/purchase_invoices/${id}/cancel-validation`, {}),
  deletePurchaseInvoice: (id: string) => del(`/purchase_invoices/${id}`),

  // Purchase Credit Notes
  getPurchaseCreditNotes: () => get<ApiPurchaseCreditNote[]>('/purchase_credit_notes'),
  createPurchaseCreditNote: (data: ApiPurchaseCreditNote) => post<ApiPurchaseCreditNote>('/purchase_credit_notes', data),
  updatePurchaseCreditNote: (id: string, data: Partial<ApiPurchaseCreditNote>) => put<ApiPurchaseCreditNote>(`/purchase_credit_notes/${id}`, data),
  validatePurchaseCreditNote: (id: string) => post<ApiPurchaseCreditNote>(`/purchase_credit_notes/${id}/validate`, {}),
  cancelPurchaseCreditNoteValidation: (id: string) => post<ApiPurchaseCreditNote>(`/purchase_credit_notes/${id}/cancel-validation`, {}),
  deletePurchaseCreditNote: (id: string) => del(`/purchase_credit_notes/${id}`),
  // --- Reglements ---
  getReglements: async (): Promise<Reglement[]> => {
    const data = await get<any[]>('/reglements/');
    return data.map(reglementFromApi);
  },

  updateReglement: async (id: string, data: any): Promise<Reglement> => {
    const result = await put<any>('/reglements/' + id, data);
    return reglementFromApi(result);
  },
  submitReglement: async (data: any): Promise<Reglement> => {
    const result = await post<any>('/reglements/submit', data);
    return reglementFromApi(result);
  },
  voidReglement: async (id: string): Promise<Reglement> => {
    const result = await post<any>('/reglements/' + id + '/void', {});
    return reglementFromApi(result);
  },
  deleteReglement: (id: string) => del('/reglements/' + id),

};



