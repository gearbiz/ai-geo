import { createHash } from 'crypto';

/**
 * The Hashing Engine - "Stale Data Guard"
 * 
 * Generates a deterministic hash from product data to detect changes.
 * Used to prevent unnecessary AI regeneration (PRD Section 2).
 * 
 * @param product - Product object containing title, description, and vendor
 * @returns SHA-256 hash as a lowercase hex string (64 characters)
 */

export interface Product {
  title: string;
  description: string;
  vendor: string;
}

export function generateProductHash(product: Product): string {
  // Create a deterministic string representation
  // Using JSON.stringify with sorted keys ensures consistent ordering
  const normalized = JSON.stringify({
    description: product.description,
    title: product.title,
    vendor: product.vendor,
  });

  // Generate SHA-256 hash
  return createHash('sha256').update(normalized).digest('hex');
}
