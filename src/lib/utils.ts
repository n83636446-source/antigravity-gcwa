import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function isDuplicateNumber<T extends { id: string }>(
  items: T[],
  numberField: keyof T,
  typedValue: string,
  editingId?: string | null
): boolean {
  return items.some(item => item[numberField] === typedValue && item.id !== editingId);
}

