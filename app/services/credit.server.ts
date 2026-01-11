/**
 * Credit Service - Protection Layer
 * 
 * Manages shop credit balances to prevent unlimited AI regeneration.
 * Implements the "No-Spam" rules from PRD Section 2.
 */

import { prisma } from '~/db.server';

export interface CheckBalanceResult {
  hasCredits: boolean;
  balance: number;
}

export interface DeductCreditResult {
  success: boolean;
  newBalance: number;
}

/**
 * Checks if a shop has available credits for AI generation.
 * 
 * @param shopId - The shop domain (e.g., "my-store.myshopify.com")
 * @returns Object with hasCredits boolean and current balance
 */
export async function checkBalance(shopId: string): Promise<CheckBalanceResult> {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopId },
    select: { credits: true },
  });

  // If shop doesn't exist, create with default credits
  if (!shop) {
    const newShop = await prisma.shop.create({
      data: { domain: shopId },
      select: { credits: true },
    });
    return {
      hasCredits: newShop.credits > 0,
      balance: newShop.credits,
    };
  }

  return {
    hasCredits: shop.credits > 0,
    balance: shop.credits,
  };
}

/**
 * Deducts credits from a shop's balance after successful AI generation.
 * 
 * @param shopId - The shop domain
 * @param amount - Number of credits to deduct (default: 1)
 * @returns Object with success boolean and new balance
 */
export async function deductCredit(
  shopId: string,
  amount: number = 1
): Promise<DeductCreditResult> {
  try {
    const shop = await prisma.shop.update({
      where: { domain: shopId },
      data: {
        credits: {
          decrement: amount,
        },
      },
      select: { credits: true },
    });

    return {
      success: true,
      newBalance: shop.credits,
    };
  } catch (error) {
    // Shop not found or other error
    return {
      success: false,
      newBalance: 0,
    };
  }
}

/**
 * Adds credits to a shop's balance (for purchases or bonuses).
 * 
 * @param shopId - The shop domain
 * @param amount - Number of credits to add
 * @returns Object with success boolean and new balance
 */
export async function addCredits(
  shopId: string,
  amount: number
): Promise<DeductCreditResult> {
  try {
    const shop = await prisma.shop.upsert({
      where: { domain: shopId },
      create: {
        domain: shopId,
        credits: 10 + amount, // Default 10 + added amount
      },
      update: {
        credits: {
          increment: amount,
        },
      },
      select: { credits: true },
    });

    return {
      success: true,
      newBalance: shop.credits,
    };
  } catch (error) {
    return {
      success: false,
      newBalance: 0,
    };
  }
}

/**
 * Gets the current credit balance for a shop.
 * 
 * @param shopId - The shop domain
 * @returns Current balance or 0 if shop not found
 */
export async function getBalance(shopId: string): Promise<number> {
  const result = await checkBalance(shopId);
  return result.balance;
}
