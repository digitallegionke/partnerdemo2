#!/bin/bash

# Helper script to update Supabase key
echo "🔑 Supabase Key Updater"
echo "====================="

if [ -z "$1" ]; then
    echo "❌ Usage: ./update-supabase-key.sh YOUR_SUPABASE_KEY"
    echo ""
    echo "🔗 Get your key from:"
    echo "   https://supabase.com/dashboard/project/zolqvkpgiauqnjgujtvl/settings/api"
    echo ""
    echo "📝 Example:"
    echo "   ./update-supabase-key.sh eyJhbGciOiJIUzI1NiIs..."
    echo ""
    exit 1
fi

SUPABASE_KEY="$1"

# Validate key format (basic check)
if [[ ! $SUPABASE_KEY =~ ^eyJ.* ]]; then
    echo "⚠️  Warning: Key doesn't start with 'eyJ' - are you sure this is correct?"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 1
    fi
fi

# Create backup
cp .env.local .env.local.backup
echo "💾 Created backup: .env.local.backup"

# Update the key
sed "s/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY/" .env.local > .env.local.tmp && mv .env.local.tmp .env.local

echo "✅ Updated .env.local with new Supabase key"
echo "🔑 Key preview: ${SUPABASE_KEY:0:30}..."

echo ""
echo "🚀 Next steps:"
echo "1. Restart your Next.js server: Ctrl+C then npm run dev"
echo "2. Test connection: node test-supabase-connection.js"
echo ""

# Test the key immediately
echo "🧪 Testing new key..."
node test-supabase-connection.js 