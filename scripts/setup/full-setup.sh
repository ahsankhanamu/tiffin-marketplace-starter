#!/bin/bash
# Full project setup script

set -e

echo "🚀 Starting full project setup..."
echo ""

cd "$(dirname "$0")/../../" || exit 1

# Step 1: Check dependencies
echo "📦 Step 1: Checking dependencies..."
./scripts/utils/check-deps.sh || {
  echo "⚠️  Some dependencies are missing. Installing..."
  npm install
}

echo ""
echo "📝 Step 2: Setting up environment files..."
./scripts/setup/setup-env.sh

echo ""
echo "🐳 Step 3: Starting Docker (if available)..."
if command -v docker &> /dev/null; then
  docker-compose up -d || echo "⚠️  Docker not available or already running"
else
  echo "ℹ️  Docker not available - using local PostgreSQL"
fi

echo ""
echo "🗄️  Step 4: Initializing database..."
cd packages/backend || exit 1
npm run db:init || {
  echo "⚠️  Database initialization had issues, but continuing..."
}

echo ""
echo "✅ Full setup complete!"
echo ""
echo "📝 Next steps:"
echo "   - Start development: npm run dev"
echo "   - View API docs: http://localhost:4000/api/docs"

