#!/bin/bash
# Check if all required dependencies are installed

set -e

echo "🔍 Checking dependencies..."

cd "$(dirname "$0")/../../" || exit 1

MISSING=0

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed"
  MISSING=1
else
  echo "✅ Node.js $(node --version)"
fi

# Check npm
if ! command -v npm &> /dev/null; then
  echo "❌ npm is not installed"
  MISSING=1
else
  echo "✅ npm $(npm --version)"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "⚠️  Docker is not installed (optional, but recommended)"
else
  echo "✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "⚠️  Docker Compose is not installed (optional, but recommended)"
else
  echo "✅ Docker Compose available"
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
  echo "⚠️  Root node_modules not found - run: npm install"
  MISSING=1
fi

if [ ! -d "packages/backend/node_modules" ]; then
  echo "⚠️  Backend node_modules not found - run: npm install"
  MISSING=1
fi

if [ ! -d "packages/frontend/node_modules" ]; then
  echo "⚠️  Frontend node_modules not found - run: npm install"
  MISSING=1
fi

if [ $MISSING -eq 0 ]; then
  echo ""
  echo "✅ All dependencies are installed!"
  exit 0
else
  echo ""
  echo "❌ Some dependencies are missing"
  exit 1
fi

