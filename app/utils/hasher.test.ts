import { describe, it, expect } from 'vitest';
import { generateProductHash } from './hasher';

/**
 * PHASE 1 - SPEC: The Hashing Engine
 * 
 * Purpose: Detect if a product has changed so we don't waste AI credits.
 * This utility implements the "Stale Data Guard" from PRD Section 2.
 */

interface Product {
  title: string;
  description: string;
  vendor: string;
}

describe('generateProductHash', () => {
  const sampleProduct: Product = {
    title: 'Handcrafted Leather Wallet',
    description: 'Premium full-grain leather wallet with RFID blocking technology.',
    vendor: 'Artisan Goods Co.',
  };

  it('should return a consistent string hash', () => {
    const hash = generateProductHash(sampleProduct);
    
    // Hash should be a non-empty string
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    
    // Hash should look like a hex string (MD5 = 32 chars, SHA-256 = 64 chars)
    expect(hash).toMatch(/^[a-f0-9]+$/i);
  });

  it('should produce the same hash for identical products', () => {
    const product1: Product = { ...sampleProduct };
    const product2: Product = { ...sampleProduct };
    
    const hash1 = generateProductHash(product1);
    const hash2 = generateProductHash(product2);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce a different hash when title changes', () => {
    const originalHash = generateProductHash(sampleProduct);
    
    const modifiedProduct: Product = {
      ...sampleProduct,
      title: 'Handcrafted Leather wallet', // lowercase 'w'
    };
    const modifiedHash = generateProductHash(modifiedProduct);
    
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should produce a different hash when description changes by one character', () => {
    const originalHash = generateProductHash(sampleProduct);
    
    const modifiedProduct: Product = {
      ...sampleProduct,
      description: 'Premium full-grain leather wallet with RFID blocking technology', // removed period
    };
    const modifiedHash = generateProductHash(modifiedProduct);
    
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should produce a different hash when vendor changes', () => {
    const originalHash = generateProductHash(sampleProduct);
    
    const modifiedProduct: Product = {
      ...sampleProduct,
      vendor: 'Artisan Goods Company', // changed Co. to Company
    };
    const modifiedHash = generateProductHash(modifiedProduct);
    
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should be deterministic across multiple calls', () => {
    const hashes = Array.from({ length: 10 }, () => generateProductHash(sampleProduct));
    
    // All hashes should be identical
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });
});
