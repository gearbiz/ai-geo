# CURRENT PROJECT CONTEXT

\_Last Updated: January 10th, 2026

# PRODUCT CONTEXT

- **Current State:** Features A, B, and C are COMPLETE. All backend services ready.
- **Next Step:** Feature D: The Onboarding UI.

## Completed Features

### Feature A: The Intelligence Layer ✅

- `app/services/credit.server.ts` - Credit protection (checkBalance, deductCredit)
- `app/services/ai.server.ts` - AI generation with Vercel AI SDK + Zod validation
- `app/services/ai.test.ts` - Vitest test suite (9 tests)
- `Shop` Prisma model with credits (default 10), brandVoice

### Feature B: The Hashing Engine ✅

- `app/utils/hasher.ts` - `generateProductHash()` utility
- `app/utils/hasher.test.ts` - Vitest test suite (6 tests)
- `ProductState` Prisma model with contentHash, schemaBlob, isSynced

### Feature C: The Schema Injector ✅

- `extensions/schema-injector/` - Theme App Extension
- `app/utils/schema-sync.server.ts` - Metafield sync utility
- App Embed Block injecting `<script type="application/ld+json">`
