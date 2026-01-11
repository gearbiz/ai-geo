/**
 * Feature D: Golden Sample Onboarding UI
 * 
 * Premium 2026 Design - "Zero-Decision" setup flow
 * Dark mode with emerald accents and glassmorphism
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
    label: 'Minimalist',
    description: 'Clean, factual, no fluff',
    prompt: 'Be extremely concise. Focus only on factual specifications. No marketing language. Just the facts.',
  },
  storyteller: {
    label: 'Storyteller',
    description: 'Warm, engaging, emotional',
    prompt: 'Be warm and engaging. Tell the story behind the product. Use inviting language that connects emotionally.',
  },
  enterprise: {
    label: 'Enterprise',
    description: 'Professional, authoritative',
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
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'generate') {
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
  const { product, credits } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  
  const [selectedTone, setSelectedTone] = useState<BrandTone>('minimalist');
  const [hasGenerated, setHasGenerated] = useState(false);

  const isGenerating = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'generate';
  const isApproving = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'approve';
  
  const schema = fetcher.data?.schema;
  const error = fetcher.data?.error;
  const creditsRemaining = fetcher.data?.creditsRemaining ?? credits;

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

  // No products state
  if (!product) {
    return (
      <div className="geo-app">
        <div className="geo-page">
          <div className="geo-header">
            <div className="geo-header__badge">⚠️ Setup Required</div>
            <h1 className="geo-header__title">No Products Found</h1>
            <p className="geo-header__subtitle">
              You need at least one product in your store to set up AI-GEO.
              Please add a product and refresh this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="geo-app">
      <div className="geo-page">
        {/* Header */}
        <header className="geo-header geo-animate-in">
          <div className="geo-header__badge">
            <span>✨</span>
            <span>Quick Setup</span>
          </div>
          <h1 className="geo-header__title">Define Your Brand Voice</h1>
          <p className="geo-header__subtitle">
            Choose how AI describes your products. Preview the result, then apply it store-wide with one click.
          </p>
        </header>

        {/* Main Content - Bento Grid */}
        <div className="geo-bento geo-bento--onboarding">
          {/* Left Column: Steps */}
          <div className="geo-bento__steps">
            <div className="geo-card geo-animate-in geo-animate-delay-1">
              {/* Step 1: Brand Tone */}
              <div className="geo-card__header">
                <div className="geo-card__number">1</div>
                <div>
                  <h2 className="geo-card__title">Choose Your Tone</h2>
                </div>
              </div>
              
              <label className="geo-label">Brand Voice Style</label>
              <select 
                className="geo-select"
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value as BrandTone)}
              >
                {Object.entries(BRAND_TONES).map(([key, tone]) => (
                  <option key={key} value={key}>
                    {tone.label} — {tone.description}
                  </option>
                ))}
              </select>

              <hr className="geo-divider" />

              {/* Step 2: Test Product */}
              <div className="geo-card__header">
                <div className="geo-card__number">2</div>
                <div>
                  <h2 className="geo-card__title">Your Test Product</h2>
                </div>
              </div>
              
              <p className="geo-card__description">
                We'll use this product to preview how your brand voice sounds.
              </p>
              
              <div className="geo-product">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.title}
                    className="geo-product__image"
                  />
                ) : (
                  <div className="geo-product__image geo-product__image--placeholder">
                    📦
                  </div>
                )}
                <div className="geo-product__info">
                  <h3 className="geo-product__title">{product.title}</h3>
                  <p className="geo-product__vendor">by {product.vendor}</p>
                </div>
              </div>

              <hr className="geo-divider" />

              {/* Step 3: Generate */}
              <div className="geo-card__header">
                <div className="geo-card__number">3</div>
                <div>
                  <h2 className="geo-card__title">Generate Preview</h2>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                <button 
                  className={`geo-btn geo-btn--primary ${isGenerating ? 'geo-btn--loading' : ''}`}
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating && <span className="geo-btn__spinner" />}
                  {isGenerating ? 'Generating...' : '⚡ Generate Preview'}
                </button>
                <span className="geo-badge geo-badge--credits">
                  {creditsRemaining} credits
                </span>
              </div>

              {error && (
                <div className="geo-alert geo-alert--error">
                  <span className="geo-alert__icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="geo-bento__preview">
            <div className="geo-card geo-card--featured geo-animate-in geo-animate-delay-2">
              <div className="geo-card__header">
                <div className="geo-card__icon">🔮</div>
                <div>
                  <h2 className="geo-card__title">JSON-LD Preview</h2>
                  <p className="geo-card__description" style={{ marginTop: '4px' }}>
                    What AI search engines will see
                  </p>
                </div>
              </div>

              <div className={`geo-code ${!schema && !isGenerating ? 'geo-code--empty' : ''}`}>
                {isGenerating ? (
                  <div>
                    <div className="geo-skeleton geo-skeleton--line" />
                    <div className="geo-skeleton geo-skeleton--line" />
                    <div className="geo-skeleton geo-skeleton--line" />
                    <div className="geo-skeleton geo-skeleton--line" style={{ width: '80%' }} />
                    <div className="geo-skeleton geo-skeleton--line" style={{ width: '60%' }} />
                    <div className="geo-skeleton geo-skeleton--line" />
                    <div className="geo-skeleton geo-skeleton--line" style={{ width: '75%' }} />
                  </div>
                ) : schema ? (
                  <pre>{JSON.stringify(schema, null, 2)}</pre>
                ) : (
                  <>
                    <div className="geo-code__placeholder-icon">{ }</div>
                    <p>Click "Generate Preview" to see your AI-generated product schema</p>
                  </>
                )}
              </div>

              {schema && (
                <div className="geo-alert geo-alert--success">
                  <span className="geo-alert__icon">✓</span>
                  <span>Schema generated! Review it above, then approve to apply store-wide.</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Action Bar */}
          <div className="geo-bento__action">
            <div className="geo-card geo-card--action geo-animate-in geo-animate-delay-3">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-lg)'
              }}>
                <div>
                  <h3 style={{ 
                    fontFamily: 'var(--font-display)', 
                    fontSize: '1.25rem', 
                    margin: '0 0 4px',
                    color: 'var(--geo-text-primary)'
                  }}>
                    {hasGenerated ? 'Ready to Launch?' : 'Generate a Preview First'}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    color: 'var(--geo-text-muted)',
                    fontSize: '0.9375rem'
                  }}>
                    {hasGenerated 
                      ? 'Lock in this brand voice for your entire product catalog.' 
                      : 'See how your products will be described before committing.'}
                  </p>
                </div>
                <button 
                  className={`geo-btn geo-btn--primary geo-btn--large ${isApproving ? 'geo-btn--loading' : ''}`}
                  onClick={handleApprove}
                  disabled={!hasGenerated || isApproving}
                >
                  {isApproving && <span className="geo-btn__spinner" />}
                  {isApproving ? 'Saving...' : '🚀 Approve & Apply Store-Wide'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
