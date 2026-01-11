-- CreateTable
CREATE TABLE "ProductState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "schemaBlob" TEXT,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "lastScannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductState_shopifyProductId_key" ON "ProductState"("shopifyProductId");

-- CreateIndex
CREATE INDEX "ProductState_shop_idx" ON "ProductState"("shop");
