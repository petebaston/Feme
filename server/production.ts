import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const assetsPath = process.env.VITE_ASSETS_ABSOLUTE_PATH || '';

// CORS configuration for BigCommerce integration
app.use(cors({
  origin: [
    /\.mybigcommerce\.com$/,
    /\.bigcommerce\.com$/,
    /localhost/,
    /\.repl\.co$/,
    /\.vercel\.app$/,
    /\.netlify\.app$/,
    ...(process.env.BIGCOMMERCE_STORE_URL ? [process.env.BIGCOMMERCE_STORE_URL] : []),
    ...(process.env.CUSTOM_DOMAIN ? [process.env.CUSTOM_DOMAIN] : [])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Store-Hash',
    'X-Channel-Id',
    'X-Requested-With'
  ]
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Allow embedding in BigCommerce storefronts
  if (req.headers.referer && req.headers.referer.includes('mybigcommerce.com')) {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://*.mybigcommerce.com');
  }
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API configuration endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    b2bApiUrl: process.env.VITE_B2B_URL || 'https://api-b2b.bigcommerce.com',
    storeHash: process.env.VITE_STORE_HASH || '',
    channelId: process.env.VITE_CHANNEL_ID || '1',
    assetsPath: assetsPath,
    environment: process.env.NODE_ENV || 'development'
  });
});

if (isProduction) {
  // Production: serve built static files
  const distPath = path.join(__dirname, '..', 'dist', 'public');
  
  console.log(`Serving static files from: ${distPath}`);
  
  // Serve static assets with caching headers
  app.use(express.static(distPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Cache static assets aggressively
      if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Cache HTML files for shorter period
      else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('Internal Server Error');
      }
    });
  });
} else {
  // Development: proxy to Vite dev server or serve message
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    
    res.send(`
      <html>
        <head>
          <title>B2B Portal - Development</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 600px; margin: 0 auto; }
            .status { padding: 20px; background: #f0f0f0; border-radius: 8px; margin: 20px 0; }
            .error { background: #ffebee; border-left: 4px solid #f44336; }
            .success { background: #e8f5e8; border-left: 4px solid #4caf50; }
            .warning { background: #fff3cd; border-left: 4px solid #ff9800; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>BigCommerce B2B Buyer Portal</h1>
            <div class="status warning">
              <h3>Development Mode</h3>
              <p>The production server is running in development mode.</p>
              <p>For development, use: <code>yarn dev</code></p>
              <p>For production build: <code>yarn build && NODE_ENV=production node server.js</code></p>
            </div>
            <div class="status">
              <h4>Environment Check</h4>
              <p><strong>Node Environment:</strong> ${process.env.NODE_ENV || 'not set'}</p>
              <p><strong>Store Hash:</strong> ${process.env.VITE_STORE_HASH ? 'configured' : 'not configured'}</p>
              <p><strong>B2B API URL:</strong> ${process.env.VITE_B2B_URL || 'not configured'}</p>
            </div>
          </div>
        </body>
      </html>
    `);
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 B2B Portal server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏪 Store Hash: ${process.env.VITE_STORE_HASH || 'not configured'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  if (isProduction) {
    console.log('✅ Serving production build');
    console.log(`📁 Static files: ${path.join(__dirname, '..', 'dist', 'public')}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
