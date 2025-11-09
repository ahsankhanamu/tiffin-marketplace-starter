# Docker Setup Guide

This project includes Dockerfiles for both backend and frontend services, along with docker-compose configurations for development and production.

## Files

- `docker-compose.yml` - Production configuration (includes postgres, backend, frontend)
- `docker-compose.dev.yml` - Development configuration (only postgres, for local dev)
- `packages/backend/Dockerfile` - Backend service Dockerfile
- `packages/frontend/Dockerfile` - Frontend service Dockerfile

## Development Setup

For local development, use the dev compose file which only runs PostgreSQL:

```bash
# Start only PostgreSQL
npm run docker:up

# Or manually
docker-compose -f docker-compose.dev.yml up -d
```

This allows you to run backend and frontend locally with hot-reload while using Docker for the database.

## Production Setup

To run the entire stack in Docker:

```bash
# Build and start all services
docker-compose up -d

# Or build first, then start
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Services

### PostgreSQL
- **Image**: `postgis/postgis:16-3.4`
- **Port**: `5432`
- **Database**: `tiffindb`
- **User**: `ahsan`
- **Password**: (none - trust authentication)

### Backend
- **Port**: `4000`
- **Environment**: Production
- **Auto-migrates**: Runs `prisma migrate deploy` on startup
- **Health**: Depends on PostgreSQL being healthy

### Frontend
- **Port**: `5173`
- **Environment**: Production
- **Build**: Uses SvelteKit adapter-node
- **Depends on**: Backend service

## Building Individual Services

```bash
# Build backend only
docker build -t tiffin-backend ./packages/backend

# Build frontend only
docker build -t tiffin-frontend ./packages/frontend

# Build with custom args
docker build --build-arg VITE_API_BASE=http://api.example.com -t tiffin-frontend ./packages/frontend
```

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (production)

### Frontend
- `VITE_API_BASE` - Backend API URL (build-time)
- `PORT` - Server port (default: 5173)
- `NODE_ENV` - Environment (production)

## Volumes

- `postgres_data` - Persistent PostgreSQL data storage

## Networks

- `tiffin-network` - Bridge network for service communication

## Troubleshooting

### Backend can't connect to database
- Ensure PostgreSQL service is healthy: `docker-compose ps`
- Check network connectivity: Services must be on the same network
- Verify DATABASE_URL uses service name `postgres` not `localhost`

### Frontend build fails
- Ensure `@sveltejs/adapter-node` is installed
- Check build logs: `docker-compose logs frontend`

### Port conflicts
- Change ports in docker-compose.yml if 4000, 5173, or 5432 are in use
- Update environment variables accordingly

## Development vs Production

**Development** (`docker-compose.dev.yml`):
- Only runs PostgreSQL
- Backend/Frontend run locally with hot-reload
- Faster iteration

**Production** (`docker-compose.yml`):
- Runs all services in containers
- Optimized builds
- No hot-reload
- Production-ready configuration

