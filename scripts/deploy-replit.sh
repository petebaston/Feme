#!/bin/bash

# BigCommerce B2B Portal - Replit Deployment Script
# This script configures and deploys the application on Replit

set -e

echo "🚀 Deploying BigCommerce B2B Portal to Replit..."

# Check if we're running on Replit
if [ -z "$REPL_SLUG" ] || [ -z "$REPL_OWNER" ]; then
    echo "⚠️  Warning: Not running on Replit environment"
    echo "   REPL_SLUG and REPL_OWNER environment variables not found"
    echo "   Continuing with local configuration..."
else
    echo "✅ Detected Replit environment"
    echo "   Repl: $REPL_SLUG"
    echo "   Owner: $REPL_OWNER"
    
    # Set Replit-specific environment variables
    export VITE_ASSETS_ABSOLUTE_PATH="https://$REPL_SLUG.$REPL_OWNER.repl.co/"
    echo "   Assets URL: $VITE_ASSETS_ABSOLUTE_PATH"
fi

# Validate required environment variables
REQUIRED_VARS=("VITE_STORE_HASH" "VITE_B2B_URL")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        echo "   Please set this variable in your Replit secrets or .env file"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Set production environment
export NODE_ENV=production
export VITE_IS_LOCAL_ENVIRONMENT=FALSE

# Build the application
echo "🔨 Building application for production..."
chmod +x scripts/build-production.sh
./scripts/build-production.sh

# Install production server dependencies
echo "📦 Installing server dependencies..."
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please ensure it exists."
    exit 1
fi

# Install additional dependencies for production server
if command -v yarn &> /dev/null; then
    yarn add express cors --production
else
    npm install express cors --only=production
fi

# Create or update .replit configuration
echo "⚙️  Configuring Replit environment..."
cat > .replit << 'EOF'
run = "chmod +x scripts/build-production.sh && ./scripts/build-production.sh && node server.js"
language = "nodejs"
entrypoint = "server.js"

[nix]
channel = "stable-22_11"

[env]
NODE_ENV = "production"
PORT = "5000"

[deployment]
run = ["sh", "-c", "chmod +x scripts/build-production.sh && ./scripts/build-production.sh && node server.js"]

[languages]

[languages.javascript]
pattern = "**/{*.js,*.jsx,*.ts,*.tsx,*.mjs}"

[languages.javascript.languageServer]
start = "typescript-language-server --stdio"

[[languages.javascript.languageServer.initializationOptions.preferences]]
includeInlayParameterNameHints = "all"
includeInlayParameterNameHintsWhenArgumentMatchesName = false
includeInlayFunctionParameterTypeHints = true
includeInlayVariableTypeHints = true
includeInlayPropertyDeclarationTypeHints = true
includeInlayFunctionLikeReturnTypeHints = true
includeInlayEnumMemberValueHints = true
EOF

# Create deployment status page
echo "📄 Creating deployment status..."
mkdir -p dist/public
cat > dist/public/deployment-status.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B2B Portal - Deployment Status</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px; margin: 0 auto; padding: 40px 20px;
            background: #f8fafc; color: #334155;
        }
        .header { text-align: center; margin-bottom: 40px; }
        .status { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .success { border-left: 4px solid #10b981; }
        .warning { border-left: 4px solid #f59e0b; }
        .error { border-left: 4px solid #ef4444; }
        .code { background: #f1f5f9; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 14px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .card h3 { margin-top: 0; color: #1e40af; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏪 BigCommerce B2B Portal</h1>
        <p>Deployment Status & Configuration Guide</p>
    </div>

    <div class="status success">
        <h2>✅ Deployment Successful</h2>
        <p>Your BigCommerce B2B Buyer Portal has been successfully deployed to Replit!</p>
        <p><strong>Build Time:</strong> $(date)</p>
        <p><strong>Environment:</strong> Production</p>
    </div>

    <div class="grid">
        <div class="card">
            <h3>🔧 Configuration Status</h3>
            <ul>
                <li><strong>Store Hash:</strong> ${VITE_STORE_HASH:+✅ Configured}${VITE_STORE_HASH:-❌ Not Set}</li>
                <li><strong>B2B API URL:</strong> ${VITE_B2B_URL:-https://api-b2b.bigcommerce.com}</li>
                <li><strong>Channel ID:</strong> ${VITE_CHANNEL_ID:-1}</li>
                <li><strong>Assets URL:</strong> ${VITE_ASSETS_ABSOLUTE_PATH:-Not Set}</li>
            </ul>
        </div>

        <div class="card">
            <h3>🚀 Next Steps</h3>
            <ol>
                <li>Verify your BigCommerce B2B Edition app is configured for custom portal</li>
                <li>Add the portal scripts to your headless storefront</li>
                <li>Test the authentication and functionality</li>
                <li>Customize the portal for your brand</li>
            </ol>
        </div>

        <div class="card">
            <h3>📚 Quick Links</h3>
            <ul>
                <li><a href="/">🏠 Portal Home</a></li>
                <li><a href="/health">❤️ Health Check</a></li>
                <li><a href="/api/config">⚙️ API Configuration</a></li>
            </ul>
        </div>

        <div class="card">
            <h3>🔗 Integration Scripts</h3>
            <p>Add these scripts to your headless storefront:</p>
            <div class="code">
&lt;script&gt;
window.B3 = {
  setting: {
    store_hash: '${VITE_STORE_HASH}',
    channel_id: ${VITE_CHANNEL_ID:-1},
  },
};
&lt;/script&gt;
&lt;script src="${VITE_ASSETS_ABSOLUTE_PATH:-https://your-repl-url/}assets/index.js"&gt;&lt;/script&gt;
            </div>
        </div>
    </div>

    <div class="status warning">
        <h3>⚠️ Important Notes</h3>
        <ul>
            <li>Ensure your BigCommerce store allows cross-origin requests from this domain</li>
            <li>Configure CORS settings if you encounter authentication issues</li>
            <li>Update your environment variables in Replit secrets for security</li>
        </ul>
    </div>
</body>
</html>
EOF

echo "✅ Replit deployment configuration completed!"
echo ""
echo "📋 Deployment Summary:"
echo "   🌐 Your portal will be available at: https://$REPL_SLUG.$REPL_OWNER.repl.co"
echo "   📊 Health check: https://$REPL_SLUG.$REPL_OWNER.repl.co/health"
echo "   ⚙️  Configuration: https://$REPL_SLUG.$REPL_OWNER.repl.co/api/config"
echo "   📄 Status page: https://$REPL_SLUG.$REPL_OWNER.repl.co/deployment-status.html"
echo ""
echo "🚀 Ready to start! Run your Repl to launch the portal."
echo ""
echo "📝 Don't forget to:"
echo "   1. Configure your BigCommerce B2B Edition app for custom portal"
echo "   2. Add the integration scripts to your headless storefront"
echo "   3. Test the complete integration flow"
