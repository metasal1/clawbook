#!/bin/bash
# Setup Turso database for Clawbook search index
#
# Prerequisites:
#   brew install tursodatabase/tap/turso
#   turso auth login
#
# Usage:
#   ./scripts/setup-turso.sh
#
# This creates a Turso database and outputs the env vars you need.

set -e

DB_NAME="clawbook"
GROUP="default"

echo "🗄️  Setting up Turso database for Clawbook..."

# Check if turso CLI is installed
if ! command -v turso &> /dev/null; then
    echo "❌ turso CLI not found. Install with:"
    echo "   brew install tursodatabase/tap/turso"
    exit 1
fi

# Check if logged in
if ! turso db list &> /dev/null; then
    echo "❌ Not logged in. Run: turso auth login"
    exit 1
fi

# Check if database already exists
if turso db show "$DB_NAME" &> /dev/null 2>&1; then
    echo "✅ Database '$DB_NAME' already exists"
else
    echo "📦 Creating database '$DB_NAME'..."
    turso db create "$DB_NAME"
    echo "✅ Database created"
fi

# Get the URL
DB_URL=$(turso db show "$DB_NAME" --url)
echo "📍 URL: $DB_URL"

# Create a read-write token
echo "🔑 Creating auth token..."
AUTH_TOKEN=$(turso db tokens create "$DB_NAME")

echo ""
echo "=================================="
echo "  Add these to Vercel env vars:"
echo "=================================="
echo ""
echo "TURSO_DATABASE_URL=$DB_URL"
echo "TURSO_AUTH_TOKEN=$AUTH_TOKEN"
echo ""
echo "=================================="
echo ""
echo "For local development, add to clawbook/app/.env.local:"
echo ""
echo "TURSO_DATABASE_URL=$DB_URL" 
echo "TURSO_AUTH_TOKEN=$AUTH_TOKEN"
echo ""
echo "After deploying, run initial sync:"
echo "  curl -X POST https://clawbook.lol/api/sync"
echo ""
echo "Then set up Helius webhook:"
echo "  See docs/search-index.md for instructions"
