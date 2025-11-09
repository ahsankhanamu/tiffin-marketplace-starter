#!/bin/bash
# Setup environment files from .env.example templates

set -e

echo "🔧 Setting up environment files..."

# Backend .env
if [ ! -f "packages/backend/.env" ]; then
  cp packages/backend/.env.example packages/backend/.env
  echo "✅ Created packages/backend/.env"
else
  echo "ℹ️  packages/backend/.env already exists"
fi

# Frontend .env
if [ ! -f "packages/frontend/.env" ]; then
  cp packages/frontend/.env.example packages/frontend/.env
  echo "✅ Created packages/frontend/.env"
else
  echo "ℹ️  packages/frontend/.env already exists"
fi

echo "✅ Environment setup complete!"

