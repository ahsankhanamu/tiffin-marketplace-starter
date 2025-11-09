#!/bin/bash
# Reset database completely

set -e

echo "⚠️  WARNING: This will delete all data in the database!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 1
fi

cd "$(dirname "$0")/../../" || exit 1

echo "🔄 Resetting database..."

# Stop Docker if running
docker-compose down 2>/dev/null || true

# Remove Docker volume
docker volume rm tiffin-marketplace-starter_postgres_data 2>/dev/null || true

# Start Docker
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Initialize database
cd packages/backend || exit 1
npm run db:init

echo "✅ Database reset complete!"

