BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateEnum
CREATE TYPE "inventory"."MoveType" AS ENUM ('IN', 'OUT', 'ADJUST_GAIN', 'ADJUST_LOSS', 'REVERSAL');

-- CreateEnum
CREATE TYPE "inventory"."DataStatus" AS ENUM ('CONFIRMED', 'NEEDS_REVIEW', 'IGNORED');

-- CreateTable
CREATE TABLE "inventory"."Item" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "safetyStock" DECIMAL(18,3),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."Location" (
    "id" SERIAL NOT NULL,
    "area" TEXT NOT NULL,
    "cabinetNo" TEXT NOT NULL,
    "displayName" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."OpeningInventory" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "rawQuantityText" TEXT,
    "containerType" TEXT,
    "containerCount" DECIMAL(18,3),
    "unitsPerContainer" DECIMAL(18,3),
    "looseQty" DECIMAL(18,3),
    "unit" TEXT,
    "normalizedQty" DECIMAL(18,3),
    "status" "inventory"."DataStatus" NOT NULL DEFAULT 'CONFIRMED',
    "sourceSheet" TEXT,
    "sourceCell" TEXT,
    "note" TEXT,
    "importBatchId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpeningInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."StockMove" (
    "id" SERIAL NOT NULL,
    "moveNo" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "type" "inventory"."MoveType" NOT NULL,
    "itemId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "rawQuantityText" TEXT,
    "containerType" TEXT,
    "containerCount" DECIMAL(18,3),
    "unitsPerContainer" DECIMAL(18,3),
    "looseQty" DECIMAL(18,3),
    "unit" TEXT,
    "normalizedQty" DECIMAL(18,3),
    "signedQty" DECIMAL(18,3),
    "status" "inventory"."DataStatus" NOT NULL DEFAULT 'CONFIRMED',
    "operator" TEXT,
    "documentNo" TEXT,
    "note" TEXT,
    "reversalOfMoveId" INTEGER,
    "importBatchId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."ArchivedRecord" (
    "id" SERIAL NOT NULL,
    "removedAt" TIMESTAMPTZ(3),
    "area" TEXT,
    "cabinetNo" TEXT,
    "itemName" TEXT NOT NULL,
    "rawQuantityText" TEXT,
    "containerType" TEXT,
    "containerCount" DECIMAL(18,3),
    "unitsPerContainer" DECIMAL(18,3),
    "looseQty" DECIMAL(18,3),
    "unit" TEXT,
    "normalizedQty" DECIMAL(18,3),
    "originalStatus" TEXT,
    "sourceCell" TEXT,
    "removalReason" TEXT,
    "note" TEXT,
    "importBatchId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."ImportBatch" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "moveCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."AuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorEmail" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "inventory"."Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_area_cabinetNo_key" ON "inventory"."Location"("area", "cabinetNo");

-- CreateIndex
CREATE INDEX "OpeningInventory_itemId_locationId_idx" ON "inventory"."OpeningInventory"("itemId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMove_moveNo_key" ON "inventory"."StockMove"("moveNo");

-- CreateIndex
CREATE UNIQUE INDEX "StockMove_reversalOfMoveId_key" ON "inventory"."StockMove"("reversalOfMoveId");

-- CreateIndex
CREATE INDEX "StockMove_itemId_locationId_occurredAt_idx" ON "inventory"."StockMove"("itemId", "locationId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMove_occurredAt_idx" ON "inventory"."StockMove"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_fileHash_key" ON "inventory"."ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "inventory"."AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "inventory"."OpeningInventory" ADD CONSTRAINT "OpeningInventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory"."Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."OpeningInventory" ADD CONSTRAINT "OpeningInventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."OpeningInventory" ADD CONSTRAINT "OpeningInventory_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "inventory"."ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMove" ADD CONSTRAINT "StockMove_reversalOfMoveId_fkey" FOREIGN KEY ("reversalOfMoveId") REFERENCES "inventory"."StockMove"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory"."StockMove" ADD CONSTRAINT "StockMove_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory"."Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMove" ADD CONSTRAINT "StockMove_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMove" ADD CONSTRAINT "StockMove_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "inventory"."ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."ArchivedRecord" ADD CONSTRAINT "ArchivedRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "inventory"."ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

