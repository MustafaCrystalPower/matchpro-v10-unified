#!/bin/bash
echo "🏗️  MatchPro Unified v4 — Setup"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install v22+ from https://nodejs.org"
    exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    corepack enable
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Check .env
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your actual credentials before starting."
fi

# Create directories
mkdir -p uploads data

# Push DB schema
echo "🗄️  Applying database schema..."
npx drizzle-kit push 2>/dev/null || echo "⚠️  DB schema push failed — ensure DATABASE_URL is configured and database is running."

# Apply additional schema
if command -v mysql &> /dev/null && [ -f scripts/init-db.sql ]; then
    echo "🗄️  Applying additional schema (passwords, market config)..."
    mysql --defaults-extra-file=<(echo -e "[client]\nuser=matchpro\npassword=matchpro\nhost=localhost") matchpro < scripts/init-db.sql 2>/dev/null || true
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start development server: pnpm run dev"
echo "🐳 Or use Docker: docker compose up -d"
echo ""
echo "📝 First-time? Visit http://localhost:3000 and create your admin account."
