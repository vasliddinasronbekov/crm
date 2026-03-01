#!/bin/bash

echo "🧹 Cleaning build cache..."
rm -rf .next
rm -rf node_modules/.cache

echo "📦 Installing/verifying dependencies..."
npm install

echo "🚀 Starting development server..."
npm run dev
