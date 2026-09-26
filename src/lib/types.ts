export type Supplier = {
  id: string;
  name: string;
  code: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  street?: string;
  city?: string;
  country?: string;
  ice?: string;
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
  description?: string;
  price: number;
  stockLevel?: number;
  reorderThreshold?: number;
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
  status: 'Brouillon' | 'Validé';
  totalHT: number;
  totalTTC: number;
  paymentMode?: string;
  deliveryDate?: string;
  supplierOrderRef?: string;
  representativeId?: string;
  reference?: string;
  remarks?: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  code?: string;
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
  purchaseReceiptId?: string;
  supplierId: string; // Added to directly link to supplier
  items: PurchaseInvoiceItem[]; // Added items
  invoiceDate: string; // ISO string
  status: 'Brouillon' | 'Non payée' | 'Payée' | 'En retard' | 'Partiellement payée';
  totalHT: number;
  totalTTC: number;
  amountPaid?: number;
  paymentMode?: string;
  dueDate?: string;
  representativeId?: string;
  reference?: string;
  remarks?: string;
};

export type PurchaseCreditNoteItem = {
  productId: string;
  quantity: number;
  price: number;
  tvaRate: number;
};

export type PurchaseCreditNote = {
  id: string;
  creditNoteNumber: string;
  purchaseInvoiceId?: string;
  supplierId: string;
  creditNoteDate: string;
  items: PurchaseCreditNoteItem[];
  status: 'Brouillon' | 'Validé';
  totalHT: number;
  totalTTC: number;
  paymentMode?: string;
  dueDate?: string;
  representativeId?: string;
  reference?: string;
  remarks?: string;
};

export type Reglement = {
  id: string;
  reglementNumber: string;
  purchaseInvoiceId: string;
  supplierId: string;
  date: string;
  amount: number;
  paymentMode?: string;
  reference?: string;
  remarks?: string;
  status: 'Actif' | 'Annulé';
};

export type Representative = {
    id: string;
    name: string;
    email?: string;
  code?: string;
};

// Converters
export function productFromApi(apiItem: any): Product {
  return {
    id: apiItem.id,
    code: apiItem.code,
    name: apiItem.name,
    description: apiItem.description || '',
    price: apiItem.price,
    stockLevel: apiItem.stock_level,
    reorderThreshold: apiItem.reorder_threshold,
    familyId: apiItem.family_id || undefined,
  };
}

export function supplierFromApi(apiItem: any): Supplier {
  return {
    id: apiItem.id,
    code: apiItem.code,
    name: apiItem.name,
    contactName: apiItem.contact_name || '',
    contactEmail: apiItem.contact_email || '',
    contactPhone: apiItem.contact_phone || '',
    street: apiItem.street || '',
    city: apiItem.city || '',
    country: apiItem.country || '',
    ice: apiItem.ice || '',
  };
}

export function clientFromApi(apiItem: any): Client {
  return {
    id: apiItem.id,
    name: apiItem.name,
    email: apiItem.email || '',
    phone: apiItem.phone || '',
    address: apiItem.address || '',
  };
}

export function representativeFromApi(apiItem: any): Representative {
  return {
    id: apiItem.id,
    code: apiItem.code || undefined,
    name: apiItem.name,
    email: apiItem.email || '',
  };
}

export function purchaseOrderFromApi(apiItem: any): PurchaseOrder {
  return {
    id: apiItem.id,
    orderNumber: apiItem.order_number,
    supplierId: apiItem.supplier_id,
    orderDate: apiItem.order_date,
    items: (apiItem.items || []).map((i: any) => ({
      productId: i.product_id || i.productId,
      quantity: i.quantity,
      price: i.price,
      tvaRate: i.tvaRate || i.tva_rate || 20,
    })),
    status: apiItem.status || 'Brouillon',
    totalHT: apiItem.total_ht,
    totalTTC: apiItem.total_ttc,
    paymentMode: apiItem.payment_mode || undefined,
    deliveryDate: apiItem.delivery_date || undefined,
    supplierOrderRef: apiItem.supplier_order_ref || undefined,
    representativeId: apiItem.representative_id || undefined,
    reference: apiItem.reference || undefined,
    remarks: apiItem.remarks || undefined,
  };
}

export function purchaseReceiptFromApi(apiItem: any): PurchaseReceipt {
  return {
    id: apiItem.id,
    receiptNumber: apiItem.receipt_number,
    purchaseOrderId: apiItem.purchase_order_id || undefined,
    supplierId: apiItem.supplier_id,
    receiptDate: apiItem.receipt_date,
    items: (apiItem.items || []).map((i: any) => ({
      productId: i.product_id || i.productId,
      quantityOrdered: i.quantityOrdered || i.quantity_ordered,
      quantityReceived: i.quantityReceived || i.quantity_received || i.quantity,
      price: i.price,
      tvaRate: i.tvaRate || i.tva_rate || 20,
    })),
    status: apiItem.status || 'Brouillon',
    totalHT: apiItem.total_ht,
    totalTTC: apiItem.total_ttc,
    paymentMode: apiItem.payment_mode || undefined,
    dueDate: apiItem.due_date || undefined,
    representativeId: apiItem.representative_id || undefined,
    reference: apiItem.reference || undefined,
    remarks: apiItem.remarks || undefined,
  };
}

export function purchaseInvoiceFromApi(apiData: any): PurchaseInvoice {
  return {
    id: apiData.id,
    invoiceNumber: apiData.invoice_number,
    purchaseOrderId: apiData.purchase_order_id || undefined,
    purchaseReceiptId: apiData.purchase_receipt_id || undefined,
    supplierId: apiData.supplier_id,
    invoiceDate: apiData.invoice_date,
    status: apiData.status,
    items: (apiData.items || []).map((item: any) => ({
        productId: item.productId || item.product_id,
        quantity: item.quantity,
        price: item.price,
        tvaRate: item.tvaRate || item.tva_rate || 20
    })),
    totalHT: apiData.total_ht,
    totalTTC: apiData.total_ttc,
    amountPaid: apiData.amount_paid || undefined,
    paymentMode: apiData.payment_mode || undefined,
    dueDate: apiData.due_date || undefined,
    representativeId: apiData.representative_id || undefined,
    reference: apiData.reference || undefined,
    remarks: apiData.remarks || undefined,
  };
}

export function purchaseInvoiceToApi(invoice: PurchaseInvoice): any {
  return {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    purchase_order_id: invoice.purchaseOrderId || null,
    purchase_receipt_id: invoice.purchaseReceiptId || null,
    supplier_id: invoice.supplierId,
    invoice_date: invoice.invoiceDate,
    status: invoice.status,
    items: invoice.items.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        tva_rate: item.tvaRate
    })),
    total_ht: invoice.totalHT,
    total_ttc: invoice.totalTTC,
    amount_paid: invoice.amountPaid || null,
    payment_mode: invoice.paymentMode || null,
    due_date: invoice.dueDate || null,
    representative_id: invoice.representativeId || null,
    reference: invoice.reference || null,
    remarks: invoice.remarks || null,
  };
}

export function purchaseCreditNoteFromApi(apiItem: any): PurchaseCreditNote {
  return {
    id: apiItem.id,
    creditNoteNumber: apiItem.credit_note_number,
    purchaseInvoiceId: apiItem.purchase_invoice_id || undefined,
    supplierId: apiItem.supplier_id,
    creditNoteDate: apiItem.credit_note_date,
    items: (apiItem.items || []).map((i: any) => ({
      productId: i.product_id || i.productId,
      quantity: i.quantity,
      price: i.price,
      tvaRate: i.tvaRate || i.tva_rate || 20,
    })),
    status: apiItem.status || 'Brouillon',
    totalHT: apiItem.total_ht,
    totalTTC: apiItem.total_ttc,
    paymentMode: apiItem.payment_mode || undefined,
    dueDate: apiItem.due_date || undefined,
    representativeId: apiItem.representative_id || undefined,
    reference: apiItem.reference || undefined,
    remarks: apiItem.remarks || undefined,
  };
}

export function reglementFromApi(apiItem: any): Reglement {
  return {
    id: apiItem.id,
    reglementNumber: apiItem.reglement_number,
    purchaseInvoiceId: apiItem.purchase_invoice_id,
    supplierId: apiItem.supplier_id,
    date: apiItem.date,
    amount: apiItem.amount,
    paymentMode: apiItem.payment_mode || undefined,
    reference: apiItem.reference || undefined,
    remarks: apiItem.remarks || undefined,
    status: apiItem.status || 'Actif',
  };
}

export function purchaseOrderToApi(item: any): any {
  return {
    id: item.id,
    order_number: item.orderNumber,
    supplier_id: item.supplierId,
    order_date: item.orderDate,
    items: (item.items || []).map((i: any) => ({
      product_id: i.productId,
      quantity: i.quantity,
      price: i.price,
      tva_rate: i.tvaRate
    })),
    status: item.status,
    total_ht: item.totalHT,
    total_ttc: item.totalTTC,
    payment_mode: item.paymentMode || null,
    delivery_date: item.deliveryDate || null,
    supplier_order_ref: item.supplierOrderRef || null,
    representative_id: item.representativeId || null,
    reference: item.reference || null,
    remarks: item.remarks || null,
  };
}

export function purchaseReceiptToApi(item: any): any {
  return {
    id: item.id,
    receipt_number: item.receiptNumber,
    purchase_order_id: item.purchaseOrderId || null,
    supplier_id: item.supplierId,
    receipt_date: item.receiptDate,
    items: (item.items || []).map((i: any) => ({
      product_id: i.productId,
      quantity: i.quantityReceived || i.quantity,
      price: i.price,
      tva_rate: i.tvaRate
    })),
    status: item.status,
    total_ht: item.totalHT,
    total_ttc: item.totalTTC,
    payment_mode: item.paymentMode || null,
    due_date: item.dueDate || null,
    representative_id: item.representativeId || null,
    reference: item.reference || null,
    remarks: item.remarks || null,
  };
}

export function purchaseCreditNoteToApi(item: any): any {
  return {
    id: item.id,
    credit_note_number: item.creditNoteNumber,
    purchase_invoice_id: item.purchaseInvoiceId || null,
    supplier_id: item.supplierId,
    credit_note_date: item.creditNoteDate,
    items: (item.items || []).map((i: any) => ({
      product_id: i.productId,
      quantity: i.quantity,
      price: i.price,
      tva_rate: i.tvaRate
    })),
    status: item.status,
    total_ht: item.totalHT,
    total_ttc: item.totalTTC,
    payment_mode: item.paymentMode || null,
    due_date: item.dueDate || null,
    representative_id: item.representativeId || null,
    reference: item.reference || null,
    remarks: item.remarks || null,
  };
}

export function supplierToApi(item: any): any {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    contact_name: item.contactName || null,
    contact_email: item.contactEmail || null,
    contact_phone: item.contactPhone || null,
    street: item.street || null,
    city: item.city || null,
    country: item.country || null,
    ice: item.ice || null,
  };
}
