-- CreateTable
CREATE TABLE "Auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "resetOtp" TEXT,
    "resetOtpExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auth_userId_key" ON "Auth"("userId");

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data from User to Auth
INSERT INTO "Auth" ("id", "userId", "password", "resetOtp", "resetOtpExpiry", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    "password",
    "resetOtp",
    "resetOtpExpiry",
    "createdAt",
    NOW()
FROM "User"
WHERE "password" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
DROP COLUMN "resetOtp",
DROP COLUMN "resetOtpExpiry";

