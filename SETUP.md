# Database Setup Guide

## Step-by-Step Setup

### 1. Start PostgreSQL with PostGIS

```bash
npm run docker:up
```

This starts a PostgreSQL container with PostGIS extension at `localhost:5432`.

**Credentials**:
- User: `ahsan`
- Password: (empty - no password)
- Database: `tiffindb`

### 2. Create Environment Files

**Option A: Use the setup script (Recommended)**
```bash
npm run setup:env
```

**Option B: Manual setup**
```bash
# Backend
cd packages/backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env
```

The `.env` file should contain:
```
DATABASE_URL="postgresql://ahsan@localhost:5432/tiffindb?schema=public"
JWT_SECRET="dev-secret-change-in-production"
PORT=4000
NODE_ENV=development

# Email Configuration (for forgot password)
SEND_EMAIL=false
EMAIL_PROVIDER=gmail
EMAIL=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:5173
```

**Note**: For forgot password functionality, configure email settings. If `SEND_EMAIL=false`, emails will be logged to console instead of being sent.

**Auto-Initialize Database on Startup** (Optional):
Add `AUTO_INIT_DB=true` to your `.env` to automatically run database initialization when the server starts if the database is not initialized. Otherwise, the server will just warn you if the database needs initialization.

### 3. Setup Database Schema

**Option A: Use the init script (Recommended - creates DB if not exists)**
```bash
cd packages/backend
npm run db:init
```

**Option B: Manual setup**
```bash
# From root directory
npm run db:setup
```

Or manually step by step:
```bash
cd packages/backend
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Create and run migrations (includes PostGIS)
npm run prisma:seed        # Seed sample data
```

### 4. Verify Setup

**Check database**:
```bash
npm run prisma:studio
```
This opens Prisma Studio where you can view/edit data.

**Or connect via psql**:
```bash
docker exec -it tiffin-postgres psql -U ahsan -d tiffindb
```

**Check PostGIS**:
```sql
SELECT PostGIS_version();
```

### 5. Reset Database (if needed)

```bash
npm run docker:down
npm run docker:up
npm run db:setup
```

## First Migration

The first migration will:
1. Create all tables (User, House, MealPlan, Order)
2. Enable PostGIS extension
3. Create a geometry column for `House.location`
4. Set up indexes

## Seed Data

The seed script creates:
- **3 Users**: Customer, Owner, Admin (all with password: `password123`)
- **3 Houses**: With PostGIS locations in Abu Dhabi
- **6 Meal Plans**: Daily and weekly plans for each house

## Troubleshooting

**PostGIS not available**:
- Ensure you're using the `postgis/postgis` Docker image
- Check migration file has `CREATE EXTENSION IF NOT EXISTS postgis;`

**Connection refused**:
- Verify Docker container is running: `docker ps`
- Check port 5432 isn't in use
- Wait a few seconds after `docker-compose up` for DB to initialize

**Migration fails**:
- Drop and recreate: `npm run docker:down && npm run docker:up`
- Then run migrations again

## Forgot Password Feature

The application includes a forgot password feature that:
- Generates a new random password when requested
- Sends the new password via email (if configured)
- Falls back to console logging if email is disabled

**API Endpoint**: `POST /api/auth/forgot-password`

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset email sent successfully",
  "emailSent": true,
  "emailSkipped": false,
  "emailReason": "Email sent successfully"
}
```

**Email Configuration**:
- Set `SEND_EMAIL=true` in `.env` to enable email sending
- Configure `EMAIL` and `EMAIL_PASSWORD` for your email provider
- For Gmail, use an App Password (not your regular password)
- If `SEND_EMAIL=false`, emails will be logged to console instead









