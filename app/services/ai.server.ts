/**
 * AI Service - Generation Layer
 * 
 * Generates JSON-LD schemas for products using OpenAI.
 * Implements the "Stale Data Guard" flow from PRD Section 2.
 * 
 * CRITICAL ORDER OF OPERATIONS:
 * 1. Check credits BEFORE calling AI
 * 2. Call AI to generate schema
 * 3. Deduct credits AFTER successful generation
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { checkBalance, deductCredit } from './credit.server';

// JSON-LD Product Schema (Schema.org compliant)
const ProductSchemaZod = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('Product'),
  name: z.string(),
  description: z.string(),
  brand: z.object({
    '@type': z.literal('Brand'),
    name: z.string(),
  }),
  // Optional fields that AI may include
  sku: z.string().optional(),
  category: z.string().optional(),
  material: z.string().optional(),
  color: z.string().optional(),
  offers: z
    .object({
      '@type': z.literal('Offer'),
      price: z.string().optional(),
      priceCurrency: z.string().optional(),
      availability: z.string().optional(),
    })
    .optional(),
});

export type ProductSchema = z.infer<typeof ProductSchemaZod>;

export interface ProductInput {
  title: string;
  description: string;
  vendor: string;
  price?: string;
  sku?: string;
}

export interface GenerateSchemaInput {
  shopId: string;
  product: ProductInput;
  brandVoice: string;
}

export interface GenerateSchemaResult {
  schema: ProductSchema;
  creditsRemaining: number;
}

/**
 * Generates a JSON-LD schema for a product using AI.
 * 
 * FLOW:
 * 1. Check if shop has credits (throws 402 if not)
 * 2. Call OpenAI to generate schema
 * 3. Deduct 1 credit on success
 * 
 * @param input - Shop ID, product data, and brand voice
 * @returns Generated schema and remaining credits
 * @throws Error with "402" if no credits available
 */
export async function generateProductSchema(
  input: GenerateSchemaInput
): Promise<GenerateSchemaResult> {
  const { shopId, product, brandVoice } = input;

  // STEP 1: Check credits BEFORE calling AI
  const balance = await checkBalance(shopId);
  if (!balance.hasCredits) {
    throw new Error('402 Payment Required: No credits available. Please purchase more credits.');
  }

  // STEP 2: Call AI to generate schema
  const systemPrompt = buildSystemPrompt(brandVoice);
  const userPrompt = buildUserPrompt(product);

  const { object: schema } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: ProductSchemaZod,
    system: systemPrompt,
    prompt: userPrompt,
  });

  // STEP 3: Deduct credits AFTER successful generation
  const deductResult = await deductCredit(shopId, 1);

  return {
    schema,
    creditsRemaining: deductResult.newBalance,
  };
}

/**
 * Builds the system prompt with brand voice instructions.
 */
function buildSystemPrompt(brandVoice: string): string {
  return `You are a JSON-LD Schema.org expert. Your task is to generate machine-readable product schemas that are optimized for:
1. LLM search engines (ChatGPT, Perplexity)
2. Google Rich Results
3. Voice assistants

BRAND VOICE GUIDELINES:
${brandVoice}

RULES:
- Output ONLY valid Schema.org Product JSON-LD
- Use the brand voice to inform how you describe the product
- Be factual and avoid hallucination - only use information provided
- Keep descriptions concise but informative
- Include all relevant product attributes`;
}

/**
 * Builds the user prompt with product data.
 */
function buildUserPrompt(product: ProductInput): string {
  return `Generate a JSON-LD Product schema for this product:

TITLE: ${product.title}
DESCRIPTION: ${product.description}
VENDOR/BRAND: ${product.vendor}
${product.sku ? `SKU: ${product.sku}` : ''}
${product.price ? `PRICE: ${product.price}` : ''}

Create a Schema.org Product JSON-LD that accurately represents this product.`;
}
