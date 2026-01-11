# SYSTEM ARCHITECTURE

## DATA FLOW

1. **Trigger:** `PRODUCTS_UPDATE` Webhook (or Manual Bulk Action).
2. **Gatekeeper:** `HashService.check(product)`.
   - _Match?_ -> Stop. Log "Skipped".
   - _No Match?_ -> Continue.
3. **Rate Limiter:** `CreditService.deduct(shopId, 1)`.
   - _Zero Credits?_ -> Throw 402 Error.
4. **Generator:** `AIService.generate(product, brandVoice)`.
   - Input: Product Title, Desc, Vendor, Meta.
   - Output: JSON-LD String.
5. **Storage:**
   - DB: Save `contentHash` and `schemaBlob` to `ProductState`.
   - Shopify: Write `schemaBlob` to Metafield `app_ai.json_ld`.
6. **Frontend:**
   - App Embed Block reads `app_ai.json_ld` and renders tag.

## TECH STACK

- **Framework:** Remix (Shopify App Template).
- **Database:** Prisma (SQLite for Dev, Postgres for Prod).
- **Queue:** Redis (Upstash) or BullMQ (for bulk processing).
- **AI:** Vercel AI SDK (wrapping Claude `Opus 4.5`).
