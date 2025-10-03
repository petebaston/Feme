// BigCommerce B2B Portal - Production Server
// This file serves as the entry point for the production deployment

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Import the production server
import('./server/production.js').then(({ default: app }) => {
  console.log('✅ B2B Portal production server loaded successfully');
}).catch((error) => {
  console.error('❌ Failed to start B2B Portal server:', error);
  process.exit(1);
});
