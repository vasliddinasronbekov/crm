#!/bin/bash

# Fix Next.js ChunkLoadError - Complete Solution

echo "🔧 Fixing Next.js ChunkLoadError..."

# Stop any running dev servers
echo "1. Stopping any running servers..."
pkill -f "next dev" || true
pkill -f "npm run dev" || true

# Clear all caches
echo "2. Clearing build caches..."
cd /home/gradientvvv/untilIwin/apps/web

# Remove Next.js cache
rm -rf .next

# Remove Turbopack cache (Next.js 15 uses Turbopack)
rm -rf .turbo

# Remove node_modules cache
rm -rf node_modules/.cache

# Clear npm cache (optional but recommended)
npm cache clean --force 2>/dev/null || true

# Reinstall dependencies (in root since it's a monorepo)
echo "3. Reinstalling dependencies..."
cd /home/gradientvvv/untilIwin
npm install --legacy-peer-deps

# Build fresh
echo "4. Building fresh Next.js app..."
cd /home/gradientvvv/untilIwin/apps/web
npm run build

echo "✅ Done! Now start the dev server with: npm run dev"
