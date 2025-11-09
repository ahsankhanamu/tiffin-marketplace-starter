-- Rename House table to Kitchen
ALTER TABLE "House" RENAME TO "Kitchen";

-- Rename foreign key columns
ALTER TABLE "MealPlan" RENAME COLUMN "houseId" TO "kitchenId";
ALTER TABLE "Order" RENAME COLUMN "houseId" TO "kitchenId";

-- Update foreign key constraint names if needed (PostgreSQL handles this automatically, but we can be explicit)
-- The constraint names will be updated automatically by Prisma

