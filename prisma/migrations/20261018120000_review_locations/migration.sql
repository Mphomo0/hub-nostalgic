-- CreateTable
CREATE TABLE "review_location" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "googleReviewUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_location_clientId_idx" ON "review_location"("clientId");

-- AddForeignKey
ALTER TABLE "review_location" ADD CONSTRAINT "review_location_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "review_request" ADD COLUMN "locationId" UUID;

-- AddForeignKey
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "review_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: each existing client's single Google link becomes its first location,
-- and every existing request points at it.
INSERT INTO "review_location" ("id", "clientId", "name", "googleReviewUrl", "updatedAt")
SELECT gen_random_uuid(), s."clientId", c."name", s."googleReviewUrl", CURRENT_TIMESTAMP
FROM "review_settings" s JOIN "client" c ON c."id" = s."clientId";

UPDATE "review_request" r SET "locationId" = l."id"
FROM "review_location" l WHERE l."clientId" = r."clientId";

-- AlterTable (after the copy above)
ALTER TABLE "review_settings" DROP COLUMN "googleReviewUrl";
