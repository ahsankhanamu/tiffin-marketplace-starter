#!/bin/bash
# Initialize database - wrapper script

set -e

cd "$(dirname "$0")/../../packages/backend" || exit 1

echo "🚀 Initializing database..."
npm run db:init

