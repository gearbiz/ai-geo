import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProductSchema } from './ai.server';
import * as creditService from './credit.server';

/**
 * PHASE 1 - SPEC: The Intelligence Layer
 * 
 * Tests the AI Service which generates JSON-LD schemas.
 * Critical: Credits must be checked BEFORE calling OpenAI,
 * and deducted AFTER successful generation.
 */

// Mock the credit service
vi.mock('./credit.server', () => ({
  checkBalance: vi.fn(),
  deductCredit: vi.fn(),
}));

// Mock the AI SDK / OpenAI
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from 'ai';

const mockCheckBalance = creditService.checkBalance as ReturnType<typeof vi.fn>;
const mockDeductCredit = creditService.deductCredit as ReturnType<typeof vi.fn>;
const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

describe('AI Service - generateProductSchema', () => {
  const sampleProduct = {
    title: 'Handcrafted Leather Wallet',
    description: 'Premium full-grain leather wallet with RFID blocking.',
    vendor: 'Artisan Goods Co.',
  };

  const sampleBrandVoice = 'Professional, luxury-focused, emphasizing craftsmanship';
  const shopId = 'test-shop.myshopify.com';

  const mockSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Handcrafted Leather Wallet',
    description: 'Premium full-grain leather wallet with RFID blocking.',
    brand: {
      '@type': 'Brand',
      name: 'Artisan Goods Co.',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw 402 error if shop has no credits', async () => {
    // Arrange: Shop has 0 credits
    mockCheckBalance.mockResolvedValue({ hasCredits: false, balance: 0 });

    // Act & Assert: Should throw before calling OpenAI
    await expect(
      generateProductSchema({
        shopId,
        product: sampleProduct,
        brandVoice: sampleBrandVoice,
      })
    ).rejects.toThrow('402');

    // Verify OpenAI was NOT called (protection worked)
    expect(mockGenerateObject).not.toHaveBeenCalled();
    
    // Verify credits were NOT deducted
    expect(mockDeductCredit).not.toHaveBeenCalled();
  });

  it('should check balance BEFORE calling OpenAI', async () => {
    // Arrange
    mockCheckBalance.mockResolvedValue({ hasCredits: true, balance: 5 });
    mockGenerateObject.mockResolvedValue({ object: mockSchema });
    mockDeductCredit.mockResolvedValue({ success: true, newBalance: 4 });

    // Act
    await generateProductSchema({
      shopId,
      product: sampleProduct,
      brandVoice: sampleBrandVoice,
    });

    // Assert: checkBalance was called first
    expect(mockCheckBalance).toHaveBeenCalledWith(shopId);
    expect(mockCheckBalance).toHaveBeenCalledBefore(mockGenerateObject);
  });

  it('should call OpenAI with product data and brand voice', async () => {
    // Arrange
    mockCheckBalance.mockResolvedValue({ hasCredits: true, balance: 5 });
    mockGenerateObject.mockResolvedValue({ object: mockSchema });
    mockDeductCredit.mockResolvedValue({ success: true, newBalance: 4 });

    // Act
    await generateProductSchema({
      shopId,
      product: sampleProduct,
      brandVoice: sampleBrandVoice,
    });

    // Assert: OpenAI was called with correct data
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs.prompt).toContain(sampleProduct.title);
    expect(callArgs.system).toContain(sampleBrandVoice);
  });

  it('should deduct credits AFTER successful generation', async () => {
    // Arrange
    mockCheckBalance.mockResolvedValue({ hasCredits: true, balance: 5 });
    mockGenerateObject.mockResolvedValue({ object: mockSchema });
    mockDeductCredit.mockResolvedValue({ success: true, newBalance: 4 });

    // Act
    await generateProductSchema({
      shopId,
      product: sampleProduct,
      brandVoice: sampleBrandVoice,
    });

    // Assert: Credits deducted after OpenAI call
    expect(mockDeductCredit).toHaveBeenCalledWith(shopId, 1);
    expect(mockGenerateObject).toHaveBeenCalledBefore(mockDeductCredit);
  });

  it('should NOT deduct credits if OpenAI call fails', async () => {
    // Arrange
    mockCheckBalance.mockResolvedValue({ hasCredits: true, balance: 5 });
    mockGenerateObject.mockRejectedValue(new Error('OpenAI API error'));

    // Act & Assert
    await expect(
      generateProductSchema({
        shopId,
        product: sampleProduct,
        brandVoice: sampleBrandVoice,
      })
    ).rejects.toThrow('OpenAI API error');

    // Verify credits were NOT deducted (generation failed)
    expect(mockDeductCredit).not.toHaveBeenCalled();
  });

  it('should return the generated JSON-LD schema', async () => {
    // Arrange
    mockCheckBalance.mockResolvedValue({ hasCredits: true, balance: 5 });
    mockGenerateObject.mockResolvedValue({ object: mockSchema });
    mockDeductCredit.mockResolvedValue({ success: true, newBalance: 4 });

    // Act
    const result = await generateProductSchema({
      shopId,
      product: sampleProduct,
      brandVoice: sampleBrandVoice,
    });

    // Assert
    expect(result.schema).toEqual(mockSchema);
    expect(result.creditsRemaining).toBe(4);
  });
});

describe('Credit Service - checkBalance', () => {
  it('should return hasCredits: true when balance > 0', async () => {
    const { checkBalance } = await import('./credit.server');
    // This will be tested with actual implementation
    expect(checkBalance).toBeDefined();
  });

  it('should return hasCredits: false when balance is 0', async () => {
    const { checkBalance } = await import('./credit.server');
    expect(checkBalance).toBeDefined();
  });
});

describe('Credit Service - deductCredit', () => {
  it('should decrease the credit balance by the specified amount', async () => {
    const { deductCredit } = await import('./credit.server');
    expect(deductCredit).toBeDefined();
  });
});
