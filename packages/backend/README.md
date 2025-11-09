
# Backend (Fastify + Prisma + PostGIS)

1. Copy `.env.example` to `.env` and set DATABASE_URL (example in file).
2. Start Postgres with Docker:
   ```
   docker-compose up -d
   ```
3. Install dependencies:
   ```
   cd packages/backend
   npm install
   ```
4. Initialize Database (creates DB if not exists, runs migrations, seeds data):
   ```
   npm run db:init
   ```
   Or manually:
   ```
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```
5. Start the server:
   ```
   npm run dev
   ```

The server will be at http://localhost:4000 and Swagger UI at http://localhost:4000/api/docs

## Features

- **Database Init Script**: `npm run db:init` - Automatically creates database if it doesn't exist, runs migrations, and seeds data
- **Forgot Password**: `POST /api/auth/forgot-password` - Generates new password and sends via email (configurable)
- **Email Service**: Supports Gmail and Office365 with fallback to console logging
