# Tiffin Marketplace

A full-stack tiffin (meal) marketplace application with geospatial discovery and real-time order tracking.

## Tech Stack

- **Backend**: Node.js + Fastify, PostgreSQL + PostGIS, Prisma ORM
- **Frontend**: SvelteKit 5, TypeScript, Tailwind CSS v4
- **Real-time**: Socket.IO
- **Auth**: JWT

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm

### Setup

1. **Start the database**:
   ```bash
   npm run docker:up
   ```

2. **Setup database**:
   ```bash
   npm run db:setup
   ```
   This will:
   - Generate Prisma client
   - Run migrations (creates tables + enables PostGIS)
   - Seed sample data

3. **Configure environment**:
   ```bash
   npm run setup:env
   ```
   This creates `.env` files from `.env.example` templates for both backend and frontend.
   Edit the `.env` files if needed (defaults should work).

4. **Start development servers**:
   ```bash
   npm run dev
   ```
   - Backend: http://localhost:4000
   - Frontend: http://localhost:5173
   - API Docs: http://localhost:4000/api/docs

### Test Credentials

After seeding, you can login with:

- **Customer**: `alice@example.com` / `password123`
- **Owner**: `owner@example.com` / `password123`
- **Admin**: `admin@example.com` / `password123`

## Project Structure

```
tiffin-marketplace/
├── packages/
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── index.js          # Fastify server
│   │   │   ├── routes/           # API routes
│   │   │   ├── middleware/      # Auth middleware
│   │   │   ├── schemas/          # Validation & Swagger schemas
│   │   │   └── seed.js           # Database seed script
│   │   └── .env.example
│   └── frontend/
│       ├── src/
│       │   ├── routes/           # SvelteKit routes
│       │   ├── lib/
│       │   │   ├── api.ts        # API client
│       │   │   ├── stores/       # Svelte stores
│       │   │   └── ui/           # UI components
│       └── ...
├── docker-compose.yml            # PostgreSQL + PostGIS
└── package.json                 # Root workspace config
```

## Available Scripts

### Root Level

- `npm run dev` - Start both backend and frontend
- `npm run docker:up` - Start PostgreSQL container
- `npm run docker:down` - Stop PostgreSQL container
- `npm run db:setup` - Setup database (migrate + seed)
- `npm run prisma:studio` - Open Prisma Studio

### Backend

- `npm run dev:backend` - Start backend dev server
- `npm run prisma:migrate` - Create and run migrations
- `npm run prisma:seed` - Seed database

### Frontend

- `npm run dev:frontend` - Start frontend dev server

## API Endpoints

See Swagger UI at `http://localhost:4000/api/docs` for full API documentation.

**Main endpoints**:
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/houses/nearby?lng=&lat=&radius=` - Find nearby houses
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details

## Features

- ✅ User authentication (Customer/Owner/Admin roles)
- ✅ Geospatial house discovery (PostGIS)
- ✅ Meal plan management
- ✅ Order placement and tracking
- ✅ Real-time order updates (Socket.IO)
- ✅ Admin dashboard
- ✅ Owner dashboard

## Database Schema

- **User**: Users with roles (user/owner/admin)
- **House**: Tiffin houses with PostGIS location
- **MealPlan**: Meal plans with pricing and schedules
- **Order**: Orders with status tracking

## Environment Variables

**Backend** (`packages/backend/.env`):
```
DATABASE_URL="postgresql://ahsan@localhost:5432/tiffindb?schema=public"
JWT_SECRET="your-secret-key"
PORT=4000
NODE_ENV=development
```

**Frontend** (`packages/frontend/.env`):
```
VITE_API_BASE=http://localhost:4000
```

## Troubleshooting

**Database connection issues**:
- Ensure Docker is running
- Check `docker-compose up -d` output
- Verify `DATABASE_URL` in `.env`

**Migrations fail**:
- Make sure PostGIS extension is enabled
- Run `npm run prisma:migrate` manually

**Port conflicts**:
- Backend: Change `PORT` in backend `.env`
- Frontend: Vite uses port 5173 by default (change in `vite.config.js`)
