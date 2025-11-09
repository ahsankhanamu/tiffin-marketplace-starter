#!/bin/bash
# Clean build artifacts and dependencies

set -e

echo "🧹 Cleaning project..."

cd "$(dirname "$0")/../../" || exit 1

# Remove node_modules
echo "Removing node_modules..."
rm -rf node_modules
rm -rf packages/*/node_modules

# Remove build artifacts
echo "Removing build artifacts..."
rm -rf packages/backend/.prisma
rm -rf packages/frontend/.svelte-kit
rm -rf packages/frontend/build
rm -rf packages/frontend/dist

# Remove logs
echo "Removing logs..."
find . -name "*.log" -type f -delete 2>/dev/null || true

echo "✅ Clean complete!"

