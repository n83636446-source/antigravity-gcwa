import { api } from '@/lib/api';

/**
 * Checks if any downstream document referencing a given foreign key exists.
 * Used to block deletion or status changes of "upstream" documents.
 *
 * @param collectionName The entity collection to search in
 * @param foreignKeyField The camelCase field holding the reference (e.g., 'purchaseOrderId')
 * @param foreignKeyValue The ID to check for
 * @returns Promise<boolean> True if at least one downstream document exists
 */
export async function hasDownstreamDocument(
  collectionName: 'purchaseReceipts' | 'purchaseInvoices' | 'purchaseCreditNotes' | 'reglements',
  foreignKeyField: string,
  foreignKeyValue: string
): Promise<boolean> {
  try {
    let items: any[] = [];
    if (collectionName === 'purchaseReceipts') items = await api.getPurchaseReceipts();
    else if (collectionName === 'purchaseInvoices') items = await api.getPurchaseInvoices();
    else if (collectionName === 'purchaseCreditNotes') items = await api.getPurchaseCreditNotes();
    else if (collectionName === 'reglements') items = await api.getReglements();

    // Support both camelCase and snake_case field names returned by the API
    const snakeField = foreignKeyField.replace(/([A-Z])/g, '_$1').toLowerCase();
    return items.some(
      (item: any) =>
        item[foreignKeyField] === foreignKeyValue ||
        item[snakeField] === foreignKeyValue
    );
  } catch {
    return false;
  }
}
