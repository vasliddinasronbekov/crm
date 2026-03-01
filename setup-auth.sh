#!/bin/bash

# ==========================================
# Authentication Setup Script
# ==========================================

echo "🚀 Setting up authentication for all apps..."
echo ""

# Create environment files
echo "📝 Creating environment files..."

# Web App
if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.local.example apps/web/.env.local
  echo "✅ Created apps/web/.env.local"
else
  echo "⚠️  apps/web/.env.local already exists"
fi

# StudentApp
if [ ! -f apps/student-app/.env ]; then
  cp apps/student-app/.env.example apps/student-app/.env
  echo "✅ Created apps/student-app/.env"
else
  echo "⚠️  apps/student-app/.env already exists"
fi

# StaffApp
if [ ! -f apps/staff-app/.env ]; then
  cp apps/staff-app/.env.example apps/staff-app/.env
  echo "✅ Created apps/staff-app/.env"
else
  echo "⚠️  apps/staff-app/.env already exists"
fi

echo ""
echo "📦 Installing dependencies..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install web dependencies
echo "Installing web app dependencies..."
cd apps/web && npm install && cd ../..

# Install student-app dependencies (already has expo-secure-store)
echo "Installing student-app dependencies..."
cd apps/student-app && npm install && cd ../..

# Install staff-app dependencies
echo "Installing staff-app dependencies..."
cd apps/staff-app && npm install && cd ../..

echo ""
echo "✅ Authentication setup complete!"
echo ""
echo "📖 Next steps:"
echo "1. Make sure Django backend is running: cd backend && python manage.py runserver 8008"
echo "2. Update .env files with your API URLs if needed"
echo "3. Read AUTH_SETUP_COMPLETE.md for usage examples"
echo "4. Test login in each app"
echo ""
echo "🎉 You're ready to implement authentication!"
