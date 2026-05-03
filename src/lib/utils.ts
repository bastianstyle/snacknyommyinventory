import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number into Indonesian Rupiah currency format.
 * @param amount The number to format.
 * @returns A string representing the amount in IDR currency format (e.g., "Rp 1.234.567").
 */
export function formatCurrencyIDR(amount: number) {
  if (isNaN(amount)) {
    amount = 0;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a Date object, timestamp, or date string into a localized Indonesian date string.
 * @param date The date to format.
 * @returns A string in the format "dd MMMM yyyy" (e.g., "17 Agustus 2024").
 */
export function formatDateID(date: Date | number | string) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}