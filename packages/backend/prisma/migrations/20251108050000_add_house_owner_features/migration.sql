-- AlterTable
ALTER TABLE "House" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "coverImage" TEXT;

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN "description" TEXT,
ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'subscription',
ADD COLUMN "menuItems" JSONB,
ADD COLUMN "trialEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trialLimit" INTEGER,
ADD COLUMN "trialPrice" DOUBLE PRECISION,
ADD COLUMN "trialValidity" TEXT,
ADD COLUMN "trialNewCustomersOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "mealType" TEXT,
ADD COLUMN "isTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduledDate" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "MealPlanSchedule" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "price" DOUBLE PRECISION,
    "startTime" TEXT,
    "endTime" TEXT,
    "orderDeadline" TEXT NOT NULL,
    "deliveryStart" TEXT,
    "deliveryEnd" TEXT,
    "maxOrders" INTEGER,
    "menuItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPlanSchedule_mealPlanId_idx" ON "MealPlanSchedule"("mealPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanSchedule_mealPlanId_dayOfWeek_mealType_key" ON "MealPlanSchedule"("mealPlanId", "dayOfWeek", "mealType");

-- CreateIndex
CREATE INDEX "TrialUsage_userId_idx" ON "TrialUsage"("userId");

-- CreateIndex
CREATE INDEX "TrialUsage_mealPlanId_idx" ON "TrialUsage"("mealPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_userId_mealPlanId_key" ON "TrialUsage"("userId", "mealPlanId");

-- AddForeignKey
ALTER TABLE "MealPlanSchedule" ADD CONSTRAINT "MealPlanSchedule_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialUsage" ADD CONSTRAINT "TrialUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialUsage" ADD CONSTRAINT "TrialUsage_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

