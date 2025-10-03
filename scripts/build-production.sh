#!/bin/bash

# BigCommerce B2B Portal - Production Build Script
# This script builds the application for production deployment

set -e

echo "🚀 Starting BigCommerce B2B Portal production build..."

# Check if required environment variables are set
if [ -z "$VITE_STORE_HASH" ]; then
    echo "❌ Error: VITE_STORE_HASH environment variable is required"
    exit 1
fi

if [ -z "$VITE_ASSETS_ABSOLUTE_PATH" ] && [ "$VITE_IS_LOCAL_ENVIRONMENT" != "TRUE" ]; then
    echo "⚠️  Warning: VITE_ASSETS_ABSOLUTE_PATH not set for production build"
    echo "   This may cause asset loading issues in production"
fi

# Environment validation
echo "📋 Environment Configuration:"
echo "   NODE_ENV: ${NODE_ENV:-development}"
echo "   VITE_IS_LOCAL_ENVIRONMENT: ${VITE_IS_LOCAL_ENVIRONMENT:-TRUE}"
echo "   VITE_STORE_HASH: ${VITE_STORE_HASH:-not set}"
echo "   VITE_B2B_URL: ${VITE_B2B_URL:-https://api-b2b.bigcommerce.com}"
echo "   VITE_ASSETS_ABSOLUTE_PATH: ${VITE_ASSETS_ABSOLUTE_PATH:-not set}"
echo "   VITE_DISABLE_BUILD_HASH: ${VITE_DISABLE_BUILD_HASH:-FALSE}"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf apps/storefront/dist/ 2>/dev/null || true

# Install dependencies
echo "📦 Installing dependencies..."
if command -v yarn &> /dev/null; then
    yarn install --frozen-lockfile
else
    npm ci
fi

# Build the application
echo "🔨 Building application..."
if [ -f "apps/storefront/package.json" ]; then
    # Monorepo structure
    echo "   Detected monorepo structure, building storefront..."
    cd apps/storefront
    if command -v yarn &> /dev/null; then
        yarn build
    else
        npm run build
    fi
    cd ../..
    
    # Copy built files to expected location
    if [ -d "apps/storefront/dist" ]; then
        mkdir -p dist/public
        cp -r apps/storefront/dist/* dist/public/
    fi
else
    # Standard structure
    echo "   Building with Vite..."
    if command -v yarn &> /dev/null; then
        yarn build
    else
        npm run build
    fi
fi

# Verify build output
if [ ! -d "dist/public" ]; then
    echo "❌ Error: Build output not found at dist/public"
    exit 1
fi

# Check for required files
REQUIRED_FILES=("index.html")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "dist/public/$file" ]; then
        echo "❌ Error: Required file $file not found in build output"
        exit 1
    fi
done

# Build summary
echo "✅ Build completed successfully!"
echo "📊 Build Summary:"
echo "   Output directory: dist/public"
echo "   Files created: $(find dist/public -type f | wc -l)"
echo "   Total size: $(du -sh dist/public | cut -f1)"

# List generated assets
echo "📁 Generated assets:"
find dist/public -name "*.js" -o -name "*.css" | head -10 | sed 's/^/   /'
if [ $(find dist/public -name "*.js" -o -name "*.css" | wc -l) -gt 10 ]; then
    echo "   ... and $(( $(find dist/public -name "*.js" -o -name "*.css" | wc -l) - 10 )) more files"
fi

# Create deployment info
echo "📝 Creating deployment info..."
cat > dist/deployment-info.json << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "nodeVersion": "$(node --version)",
  "environment": {
    "NODE_ENV": "${NODE_ENV:-development}",
    "VITE_IS_LOCAL_ENVIRONMENT": "${VITE_IS_LOCAL_ENVIRONMENT:-TRUE}",
    "VITE_STORE_HASH": "${VITE_STORE_HASH:-not_set}",
    "VITE_ASSETS_ABSOLUTE_PATH": "${VITE_ASSETS_ABSOLUTE_PATH:-not_set}"
  }
}
EOF

echo "🎉 Production build ready for deployment!"
echo "   Next steps:"
echo "   1. Upload the contents of 'dist/public' to your hosting provider"
echo "   2. Configure your server to serve these files"
echo "   3. Update your BigCommerce store to point to the hosted assets"
echo ""
echo "   For Replit deployment: run 'chmod +x scripts/deploy-replit.sh && ./scripts/deploy-replit.sh'"
