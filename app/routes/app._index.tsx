/**
 * AI-GEO Dashboard
 * 
 * Premium 2026 Design - Main control center
 * Shows stats, sync status, and quick actions
 */

import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { prisma } from "../db.server";

// GraphQL query to get product count
const PRODUCTS_COUNT_QUERY = `#graphql
  query GetProductsCount {
    productsCount {
      count
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Check if shop needs onboarding
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { isOnboarded: true, credits: true, brandVoice: true },
  });

  // Redirect to onboarding if not completed
  if (!shop?.isOnboarded) {
    throw redirect('/app/onboarding');
  }

  // Get synced products count
  const syncedProducts = await prisma.productState.count({
    where: { shop: shopDomain, isSynced: true },
  });

  const pendingProducts = await prisma.productState.count({
    where: { shop: shopDomain, isSynced: false },
  });

  // Get total products from Shopify
  const response = await admin.graphql(PRODUCTS_COUNT_QUERY);
  const data = await response.json();
  const totalProducts = data.data?.productsCount?.count ?? 0;

  // Determine brand voice label
  let brandVoiceLabel = 'Not Set';
  if (shop.brandVoice?.includes('concise')) {
    brandVoiceLabel = 'Minimalist';
  } else if (shop.brandVoice?.includes('warm')) {
    brandVoiceLabel = 'Storyteller';
  } else if (shop.brandVoice?.includes('professional')) {
    brandVoiceLabel = 'Enterprise';
  }

  return {
    shopDomain,
    credits: shop.credits,
    brandVoice: brandVoiceLabel,
    syncedProducts,
    pendingProducts,
    totalProducts,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'sync_all') {
    // TODO: Implement batch sync
    return { success: true, message: 'Sync started' };
  }

  return { success: false, message: 'Unknown action' };
};

export default function Dashboard() {
  const { 
    credits, 
    brandVoice, 
    syncedProducts, 
    pendingProducts, 
    totalProducts 
  } = useLoaderData<typeof loader>();
  
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const syncProgress = totalProducts > 0 
    ? Math.round((syncedProducts / totalProducts) * 100) 
    : 0;

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Sync started!");
    }
  }, [fetcher.data, shopify]);

  return (
    <div className="geo-app">
      <div className="geo-page">
        {/* Header */}
        <header className="geo-header geo-animate-in">
          <div className="geo-header__badge">
            <span>⚡</span>
            <span>Dashboard</span>
          </div>
          <h1 className="geo-header__title">AI-GEO Control Center</h1>
          <p className="geo-header__subtitle">
            Monitor your product schema sync status and manage AI generation credits.
          </p>
        </header>

        {/* Stats Grid */}
        <div className="geo-stats geo-animate-in geo-animate-delay-1">
          <div className="geo-stat">
            <div className="geo-stat__value">{credits}</div>
            <div className="geo-stat__label">Credits Remaining</div>
          </div>
          <div className="geo-stat">
            <div className="geo-stat__value">{syncedProducts}</div>
            <div className="geo-stat__label">Products Synced</div>
          </div>
          <div className="geo-stat">
            <div className="geo-stat__value">{totalProducts}</div>
            <div className="geo-stat__label">Total Products</div>
          </div>
          <div className="geo-stat">
            <div className="geo-stat__value" style={{ fontSize: '1.5rem', color: 'var(--geo-text-secondary)' }}>
              {brandVoice}
            </div>
            <div className="geo-stat__label">Brand Voice</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 'var(--space-lg)',
          marginTop: 'var(--space-2xl)'
        }}>
          {/* Sync Status Card */}
          <div className="geo-card geo-card--featured geo-animate-in geo-animate-delay-2">
            <div className="geo-card__header">
              <div className="geo-card__icon">📊</div>
              <div>
                <h2 className="geo-card__title">Sync Progress</h2>
                <p className="geo-card__description" style={{ marginTop: '4px' }}>
                  Products with AI-generated schemas
                </p>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-lg)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: 'var(--space-sm)',
                fontSize: '0.875rem'
              }}>
                <span style={{ color: 'var(--geo-text-muted)' }}>
                  {syncedProducts} of {totalProducts} products
                </span>
                <span style={{ 
                  color: 'var(--geo-emerald-400)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: '500'
                }}>
                  {syncProgress}%
                </span>
              </div>
              <div className="geo-progress">
                <div 
                  className="geo-progress__bar" 
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>

            {pendingProducts > 0 && (
              <div className="geo-alert geo-alert--success" style={{ marginTop: 'var(--space-lg)' }}>
                <span className="geo-alert__icon">💡</span>
                <span>{pendingProducts} products ready to sync</span>
              </div>
            )}

            <div style={{ marginTop: 'var(--space-xl)' }}>
              <fetcher.Form method="POST">
                <input type="hidden" name="intent" value="sync_all" />
                <button 
                  type="submit"
                  className="geo-btn geo-btn--primary"
                  disabled={credits === 0 || fetcher.state !== 'idle'}
                  style={{ width: '100%' }}
                >
                  {fetcher.state !== 'idle' ? '⏳ Syncing...' : '🔄 Sync All Products'}
                </button>
              </fetcher.Form>
              {credits === 0 && (
                <p style={{ 
                  marginTop: 'var(--space-sm)', 
                  fontSize: '0.8125rem',
                  color: 'var(--geo-amber-400)',
                  textAlign: 'center'
                }}>
                  You need credits to sync products
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="geo-card geo-animate-in geo-animate-delay-3">
            <div className="geo-card__header">
              <div className="geo-card__icon">⚙️</div>
              <div>
                <h2 className="geo-card__title">Quick Actions</h2>
                <p className="geo-card__description" style={{ marginTop: '4px' }}>
                  Manage your AI-GEO settings
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 'var(--space-md)',
              marginTop: 'var(--space-lg)'
            }}>
              <a 
                href="/app/onboarding" 
                className="geo-btn geo-btn--secondary"
                style={{ textDecoration: 'none', textAlign: 'center' }}
              >
                🎨 Change Brand Voice
              </a>
              <button className="geo-btn geo-btn--secondary" disabled>
                💳 Purchase Credits (Coming Soon)
              </button>
              <button className="geo-btn geo-btn--secondary" disabled>
                📈 View Analytics (Coming Soon)
              </button>
            </div>
          </div>

          {/* How It Works Card */}
          <div className="geo-card geo-animate-in geo-animate-delay-4" style={{ gridColumn: '1 / -1' }}>
            <div className="geo-card__header">
              <div className="geo-card__icon">🔮</div>
              <div>
                <h2 className="geo-card__title">How AI-GEO Works</h2>
                <p className="geo-card__description" style={{ marginTop: '4px' }}>
                  Your products become visible to AI search engines
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-xl)',
              marginTop: 'var(--space-xl)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  marginBottom: 'var(--space-md)',
                  opacity: 0.9
                }}>
                  1️⃣
                </div>
                <h4 style={{ 
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.125rem',
                  margin: '0 0 var(--space-sm)',
                  color: 'var(--geo-text-primary)'
                }}>
                  AI Analyzes
                </h4>
                <p style={{ 
                  fontSize: '0.875rem',
                  color: 'var(--geo-text-muted)',
                  margin: 0,
                  lineHeight: 1.6
                }}>
                  Our AI reads your product data and generates rich JSON-LD schemas
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  marginBottom: 'var(--space-md)',
                  opacity: 0.9
                }}>
                  2️⃣
                </div>
                <h4 style={{ 
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.125rem',
                  margin: '0 0 var(--space-sm)',
                  color: 'var(--geo-text-primary)'
                }}>
                  Auto-Inject
                </h4>
                <p style={{ 
                  fontSize: '0.875rem',
                  color: 'var(--geo-text-muted)',
                  margin: 0,
                  lineHeight: 1.6
                }}>
                  Schemas are automatically injected into your product pages
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  marginBottom: 'var(--space-md)',
                  opacity: 0.9
                }}>
                  3️⃣
                </div>
                <h4 style={{ 
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.125rem',
                  margin: '0 0 var(--space-sm)',
                  color: 'var(--geo-text-primary)'
                }}>
                  AI Discovery
                </h4>
                <p style={{ 
                  fontSize: '0.875rem',
                  color: 'var(--geo-text-muted)',
                  margin: 0,
                  lineHeight: 1.6
                }}>
                  ChatGPT, Perplexity & AI assistants can now recommend your products
                </p>
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
