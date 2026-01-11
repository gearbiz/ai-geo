/**
 * Feature D: Golden Sample Onboarding UI
 * 
 * "Zero-Decision" setup flow where merchants:
 * 1. Select a Brand Tone
 * 2. Preview AI-generated JSON-LD on their first product
 * 3. Approve & lock in the style for their entire store
 */

import { useState } from 'react';
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from 'react-router';
import { redirect, useFetcher, useLoaderData } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { authenticate } from '../shopify.server';
import { prisma } from '../db.server';
import { generateProductSchema } from '../services/ai.server';

// Brand tone options with their AI prompts
const BRAND_TONES = {
  minimalist: {
    label: 'Minimalist (Facts Only)',
    prompt: 'Be extremely concise. Focus only on factual specifications. No marketing language. Just the facts.',
  },
  storyteller: {
    label: 'Storyteller (Warm)',
    prompt: 'Be warm and engaging. Tell the story behind the product. Use inviting language that connects emotionally.',
  },
  enterprise: {
    label: 'Enterprise (Professional)',
    prompt: 'Be professional and authoritative. Emphasize quality, reliability, and business value. Formal tone.',
  },
} as const;

type BrandTone = keyof typeof BRAND_TONES;

// GraphQL query to fetch first product
const FIRST_PRODUCT_QUERY = `#graphql
  query GetFirstProduct {
    products(first: 1) {
      edges {
        node {
          id
          title
          description
          vendor
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
            altText
          }
        }
      }
    }
  }
`;

interface ProductData {
  id: string;
  title: string;
  description: string;
  vendor: string;
  price?: string;
  imageUrl?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Check if already onboarded - redirect to dashboard
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { isOnboarded: true, brandVoice: true, credits: true },
  });

  if (shop?.isOnboarded) {
    throw redirect('/app');
  }

  // Fetch the first product as our "Test Subject"
  const response = await admin.graphql(FIRST_PRODUCT_QUERY);
  const data = await response.json();
  
  const productEdge = data.data?.products?.edges?.[0];
  const product: ProductData | null = productEdge
    ? {
        id: productEdge.node.id,
        title: productEdge.node.title || 'Untitled Product',
        description: productEdge.node.description || '',
        vendor: productEdge.node.vendor || 'Unknown',
        price: productEdge.node.priceRangeV2?.minVariantPrice?.amount,
        imageUrl: productEdge.node.featuredImage?.url,
      }
    : null;

  return {
    shopDomain,
    product,
    credits: shop?.credits ?? 10,
    brandTones: Object.entries(BRAND_TONES).map(([key, value]) => ({
      value: key,
      label: value.label,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'generate') {
    // Generate preview schema
    const brandTone = formData.get('brandTone') as BrandTone;
    const productJson = formData.get('product') as string;
    
    if (!brandTone || !productJson) {
      return { error: 'Missing required fields', schema: null };
    }

    const product = JSON.parse(productJson) as ProductData;
    const brandVoice = BRAND_TONES[brandTone].prompt;

    try {
      const result = await generateProductSchema({
        shopId: shopDomain,
        product: {
          title: product.title,
          description: product.description,
          vendor: product.vendor,
          price: product.price,
        },
        brandVoice,
      });

      return {
        schema: result.schema,
        creditsRemaining: result.creditsRemaining,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      return { error: message, schema: null };
    }
  }

  if (intent === 'approve') {
    // Save brand tone and mark as onboarded
    const brandTone = formData.get('brandTone') as BrandTone;
    
    if (!brandTone) {
      return { error: 'Please select a brand tone first', schema: null };
    }

    const brandVoice = BRAND_TONES[brandTone].prompt;

    await prisma.shop.upsert({
      where: { domain: shopDomain },
      create: {
        domain: shopDomain,
        brandVoice,
        isOnboarded: true,
      },
      update: {
        brandVoice,
        isOnboarded: true,
      },
    });

    throw redirect('/app');
  }

  return { error: 'Unknown action', schema: null };
};

export default function Onboarding() {
  const { product, credits, brandTones } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  
  const [selectedTone, setSelectedTone] = useState<BrandTone>('minimalist');
  const [hasGenerated, setHasGenerated] = useState(false);

  const isGenerating = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'generate';
  const isApproving = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'approve';
  
  const schema = fetcher.data?.schema;
  const error = fetcher.data?.error;
  const creditsRemaining = fetcher.data?.creditsRemaining ?? credits;

  // Track when we've generated a preview
  if (schema && !hasGenerated) {
    setHasGenerated(true);
  }

  const handleGenerate = () => {
    if (!product) return;
    
    fetcher.submit(
      {
        intent: 'generate',
        brandTone: selectedTone,
        product: JSON.stringify(product),
      },
      { method: 'POST' }
    );
  };

  const handleApprove = () => {
    fetcher.submit(
      {
        intent: 'approve',
        brandTone: selectedTone,
      },
      { method: 'POST' }
    );
  };

  if (!product) {
    return (
      <s-page heading="No Products Found">
        <s-section>
          <s-banner status="warning">
            <s-text>
              You need at least one product in your store to set up AI-GEO.
              Please add a product and refresh this page.
            </s-text>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Set Up Your Brand Voice">
      <s-section>
        <s-text>
          Let's configure how AI-GEO describes your products. Choose a tone, preview
          the result on your first product, then approve to apply it store-wide.
        </s-text>
      </s-section>

      <s-layout columns="1fr 1fr">
        {/* Left Column: Controls */}
        <s-layout-item>
          <s-card>
            <s-stack direction="block" gap="loose">
              <s-heading>1. Choose Your Brand Tone</s-heading>
              
              <s-select
                label="Brand Tone"
                value={selectedTone}
                onChange={(e: CustomEvent) => setSelectedTone(e.detail as BrandTone)}
              >
                {brandTones.map((tone) => (
                  <s-option key={tone.value} value={tone.value}>
                    {tone.label}
                  </s-option>
                ))}
              </s-select>

              <s-divider />

              <s-heading>2. Your Test Product</s-heading>
              
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="tight">
                  <s-text fontWeight="bold">{product.title}</s-text>
                  <s-text color="subdued">by {product.vendor}</s-text>
                  {product.description && (
                    <s-text>
                      {product.description.slice(0, 150)}
                      {product.description.length > 150 ? '...' : ''}
                    </s-text>
                  )}
                </s-stack>
              </s-box>

              <s-divider />

              <s-heading>3. Generate Preview</s-heading>
              
              <s-stack direction="inline" gap="tight" align="center">
                <s-button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  loading={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Generate Preview'}
                </s-button>
                <s-text color="subdued">
                  Credits: {creditsRemaining}
                </s-text>
              </s-stack>

              {error && (
                <s-banner status="critical">
                  <s-text>{error}</s-text>
                </s-banner>
              )}
            </s-stack>
          </s-card>
        </s-layout-item>

        {/* Right Column: Preview Result */}
        <s-layout-item>
          <s-card>
            <s-stack direction="block" gap="loose">
              <s-heading>JSON-LD Preview</s-heading>
              <s-text color="subdued">
                This is what AI search engines (ChatGPT, Perplexity) will see.
              </s-text>

              <s-box
                padding="base"
                background="subdued"
                borderRadius="base"
                borderWidth="base"
                style={{ minHeight: '300px' }}
              >
                {isGenerating ? (
                  <s-stack direction="block" gap="tight">
                    <s-skeleton-body-text lines={3} />
                    <s-skeleton-body-text lines={4} />
                    <s-skeleton-body-text lines={2} />
                  </s-stack>
                ) : schema ? (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                    <code>{JSON.stringify(schema, null, 2)}</code>
                  </pre>
                ) : (
                  <s-stack direction="block" gap="base" align="center">
                    <s-text color="subdued" alignment="center">
                      Click "Generate Preview" to see your AI-generated product schema.
                    </s-text>
                  </s-stack>
                )}
              </s-box>

              {schema && (
                <s-banner status="success">
                  <s-text>
                    ✓ Schema generated successfully! Review it above, then approve to
                    apply this style to your entire store.
                  </s-text>
                </s-banner>
              )}
            </s-stack>
          </s-card>
        </s-layout-item>
      </s-layout>

      {/* Bottom Action Bar */}
      <s-section>
        <s-card>
          <s-stack direction="inline" gap="base" align="center" distribute="space-between">
            <s-text>
              {hasGenerated
                ? 'Happy with the preview? Lock it in for your entire store.'
                : 'Generate a preview first to see how your products will be described.'}
            </s-text>
            <s-button
              variant="primary"
              onClick={handleApprove}
              disabled={!hasGenerated || isApproving}
              loading={isApproving}
            >
              {isApproving ? 'Saving...' : 'Approve & Standardize Entire Store'}
            </s-button>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
