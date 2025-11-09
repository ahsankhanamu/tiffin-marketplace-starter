/**
 * Seed script: creates some users and houses. Requires Postgres+PostGIS and prisma migrate applied.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash passwords
  const userPassword = await bcrypt.hash('password123', 10);
  const ownerPassword = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('password123', 10);

  // Create users with auth
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Customer',
      role: 'user',
      auth: {
        create: {
          password: userPassword
        }
      }
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      name: 'Tiffin Owner',
      role: 'owner',
      auth: {
        create: {
          password: ownerPassword
        }
      }
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      auth: {
        create: {
          password: adminPassword
        }
      }
    }
  });

  console.log('✅ Created users: alice@example.com, owner@example.com, admin@example.com (password: password123)');

  // Create kitchens with PostGIS geometry (longitude, latitude)
  // Abu Dhabi coordinates: ~54.3773° E, 24.4539° N
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Kitchen" (id, "ownerId", title, description, location, "createdAt")
    VALUES
      (
        gen_random_uuid()::text,
        $1,
        'Spicy Delights Tiffin',
        'Authentic Indian cuisine with daily fresh meals',
        ST_SetSRID(ST_MakePoint(54.3773, 24.4539), 4326),
        now()
      ),
      (
        gen_random_uuid()::text,
        $1,
        'Mama\'s Kitchen',
        'Home-style cooking with vegetarian options',
        ST_SetSRID(ST_MakePoint(54.3670, 24.4580), 4326),
        now()
      ),
      (
        gen_random_uuid()::text,
        $1,
        'Quick Bites Express',
        'Fast and fresh meals for busy professionals',
        ST_SetSRID(ST_MakePoint(54.3820, 24.4480), 4326),
        now()
      )
    ON CONFLICT DO NOTHING;
  `, owner.id);

  console.log('✅ Created sample tiffin kitchens');

  // Get created kitchens to add meal plans
  const kitchens = await prisma.kitchen.findMany({
    where: { ownerId: owner.id },
    take: 3
  });

  // Create sample meal plans
  for (const kitchen of kitchens) {
    const existingPlans = await prisma.mealPlan.findMany({
      where: { kitchenId: kitchen.id }
    });

    if (existingPlans.length === 0) {
      await prisma.mealPlan.createMany({
        data: [
          {
            kitchenId: kitchen.id,
            name: 'Daily Meal Plan',
            price: 25.00,
            billingCycle: 'daily',
            availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            startTime: '09:00',
            endTime: '21:00',
            items: JSON.stringify([
              { name: 'Rice', qty: '1 cup' },
              { name: 'Curry', qty: '1 bowl' },
              { name: 'Roti', qty: '2 pieces' },
              { name: 'Salad', qty: '1 portion' }
            ])
          },
          {
            kitchenId: kitchen.id,
            name: 'Weekly Subscription',
            price: 150.00,
            billingCycle: 'weekly',
            availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            startTime: '09:00',
            endTime: '21:00',
            items: JSON.stringify([
              { name: 'Full Meal', qty: '1 portion' },
              { name: 'Dessert', qty: '1 piece' },
              { name: 'Drink', qty: '1 glass' }
            ])
          }
        ]
      });
    }
  }

  console.log('✅ Created sample meal plans');

  console.log('🎉 Seeding completed!');
  console.log('\n📝 Test credentials:');
  console.log('  Customer: alice@example.com / password123');
  console.log('  Owner: owner@example.com / password123');
  console.log('  Admin: admin@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
