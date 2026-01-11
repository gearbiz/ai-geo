# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Project Name:** AI-GEO Middleware (Project "Standardize")
**Goal:** Make Shopify stores discoverable in LLM search (ChatGPT/Perplexity) by injecting hallucination-free JSON-LD.

## 1. THE CORE PROBLEM

- **User:** High-end Shopify Merchants (Founders).
- **Pain:** LLMs cannot read visual HTML efficiently. Traditional SEO metadata is ignored by AI.
- **Solution:** A middleware app that converts Product Data -> Machine-Readable JSON-LD Schema.

## 2. BUSINESS LOGIC (The "No-Spam" Rules)

- **The "Manager" Philosophy:** Users do not write; they approve. No "Regenerate" button spamming.
- **Stale Data Guard:**
  - Before generating, hash the product data (MD5).
  - Compare with `ProductState.contentHash`.
  - If Match: Return cached result (Cost = $0).
  - If Differs: Call AI (Cost = $$).
- **Credit System:**
  - Hard limit on monthly generations.
  - Users purchase "Standardization Credits".

## 3. CORE FEATURES (MVP)

### A. Onboarding & Golden Sample

- User sets "Brand Voice" (Global Setting).
- User tunes ONE product ("Golden Sample").
- Once approved, this System Prompt is locked for the store.

### B. The Hashing Engine (Backend)

- `generateProductHash(product)`: Utility to detect changes.
- `ProductState` Table: Stores `shopifyProductId`, `contentHash`, `schemaBlob`, `isSynced`.

### C. The Schema Injector

- Uses **App Embed Blocks** (Theme App Extension).
- Injects `<script type="application/ld+json">` populated by a private Metafield.
- **NEVER** touches `theme.liquid` or `body_html`.

## 4. VALIDATION PROTOCOL

- **Syntax Check (Automated):** Zod schema validation in TDD.
- **Reality Check (Manual):**
  1. Google Rich Results Test (Green Checkmarks).
  2. "The ChatGPT Test" (Can AI read the raw HTML?).
