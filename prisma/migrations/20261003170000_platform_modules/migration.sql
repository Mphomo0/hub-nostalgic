-- Platform modules: per-client module switches, and Reviews settings moved
-- out of the shared "client" table into the Reviews module's own table.

-- CreateTable
CREATE TABLE "client_module" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_settings" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "googleReviewUrl" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_module_clientId_module_key" ON "client_module"("clientId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "review_settings_clientId_key" ON "review_settings"("clientId");

-- AddForeignKey
ALTER TABLE "client_module" ADD CONSTRAINT "client_module_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_settings" ADD CONSTRAINT "review_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: every existing client already uses Reviews, so switch the module on
-- and copy their Google link + reminder setting across.
INSERT INTO "client_module" ("id", "clientId", "module", "updatedAt")
SELECT gen_random_uuid(), "id", 'reviews', CURRENT_TIMESTAMP FROM "client";

INSERT INTO "review_settings" ("id", "clientId", "googleReviewUrl", "remindersEnabled", "updatedAt")
SELECT gen_random_uuid(), "id", "googleReviewUrl", "remindersEnabled", CURRENT_TIMESTAMP FROM "client";

-- AlterTable (after the copy above)
ALTER TABLE "client" DROP COLUMN "googleReviewUrl",
DROP COLUMN "remindersEnabled";
