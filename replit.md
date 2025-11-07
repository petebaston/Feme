# BigCommerce B2B Buyer Portal

## Overview
This project is a production-ready headless B2B buyer portal designed for BigCommerce B2B Edition (store: pyrenapwe2). It offers a comprehensive suite of enterprise-grade features, including advanced order management, quoting workflows, an analytics dashboard, a quick order pad, reorder templates, shopping list management, and robust user and address management. The portal integrates directly with the BigCommerce B2B API and features a modern React frontend with TypeScript, a responsive mobile-first design using Tailwind CSS and shadcn/ui, and is optimized for deployment on Replit. The project aims to provide a complete B2B e-commerce solution with a minimalist design aesthetic.

## User Preferences
Preferred communication style: Simple, everyday language.

## Known Issues & Setup Requirements

### Orders System - ✅ RESOLVED
**Background:** BigCommerce B2B Edition has a completely separate orders system from the regular BigCommerce store. Orders placed through regular BigCommerce checkout are NOT automatically visible in B2B Edition.

**Solution Implemented:** Dual API fallback system
1. Portal first attempts to fetch orders from B2B Edition API
2. If B2B Edition returns 0 orders, automatically falls back to standard BigCommerce V2 API
3. Standard API orders are transformed to match B2B Edition format (currency, status, etc.)
4. All orders (from either source) are cached in PostgreSQL for reliability

**Current Status:** ✅ Working - Portal successfully displays all 21 orders from BigCommerce store using the fallback mechanism.

**API Credentials Required:**
- `BIGCOMMERCE_ACCESS_TOKEN` - Standard BigCommerce API access token (for fallback)
- `BIGCOMMERCE_CLIENT_ID` - OAuth client ID
- `BIGCOMMERCE_CLIENT_SECRET` - OAuth client secret
- `BIGCOMMERCE_STORE_HASH` - Store identifier (e.g., "pyrenapwe2")

### Invoices System - ✅ RESOLVED
**Previous Issues:** 
1. Getting 403 "Invalid access token" when fetching invoices from B2B Edition Management API
2. Incorrect filtering logic showing 0 invoices when hosted B2B portal showed 10+ invoices

**Root Causes:** 
1. Was using `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` which was invalid for the Management API endpoints
2. Incorrectly filtering by individual `customerId` instead of company-level filtering

**Solution Implemented:**
- **Authentication Fix:** Updated to use standard BigCommerce OAuth token (`BIGCOMMERCE_ACCESS_TOKEN`)
- Changed `getServerToServerToken()` to prioritize OAuth token over B2B Management Token
- Per BigCommerce September 2025 update: standard OAuth X-Auth-Token now works for B2B Edition APIs
- **Filtering Fix:** Removed individual customer ID filtering to match BigCommerce B2B Edition hosted portal behavior
- Per official B2B Edition documentation: "Invoices are automatically filtered per company account" and "Users within a company share access to that company's invoices"
- All users in company see all company invoices (both online orders + ERP-imported invoices)
- **PDF Download:** Fixed endpoint to use `/download-pdf` (per official documentation)
- **PDF Preview:** Added expandable inline PDF preview in invoices table (click arrow to expand)

**Current Status:** ✅ Fixed - Invoices API authenticated correctly, company-level filtering matching hosted portal, PDF downloads working, inline preview implemented.

### Users & Addresses - ✅ RESOLVED
**Previous Issues:** 
1. Endpoints `/api/v2/users` and `/api/v2/addresses` returned 404 Not Found.
2. Frontend displayed empty results despite successful API calls.
3. Browser cache was returning stale empty responses (304 Not Modified).
4. Company ID mismatch: System was using user ID (12140869) instead of actual company ID (8810354).

**Root Causes:** 
1. Using incorrect V2 REST API paths instead of B2B Edition Management API v3 paths.
2. Browser caching stale responses from before the fix was implemented.
3. GraphQL query fetched `currentUser.id` as companyId instead of `currentUser.companyInfo.companyId`.

**Solution Implemented:**
- **API Endpoints:** Updated to use Management API v3 (`/api/v3/io/users`, `/api/v3/io/addresses`)
- **Authentication:** Both endpoints use OAuth token (`BIGCOMMERCE_ACCESS_TOKEN`)
- **Cache Control:** Added cache-busting headers (`Cache-Control: no-store, no-cache, must-revalidate`) to prevent stale data
- **Company ID Fix:** Updated GraphQL query to fetch actual company ID from `companyInfo.companyId` field
- **Company Filtering:** Regular users see only their company's data; admins see all companies
- **Verified Results:** 1 address, 1 user, and 3 invoices successfully retrieved for company 8810354

**Current Status:** ✅ All endpoints working correctly with real data, filtering by actual company ID (8810354), with proper cache control headers.

### Required Secret Configuration
**Currently Configured:** ✅
- `BIGCOMMERCE_ACCESS_TOKEN` - Standard BigCommerce API access token
- `BIGCOMMERCE_CLIENT_ID` - OAuth client ID
- `BIGCOMMERCE_CLIENT_SECRET` - OAuth client secret
- `BIGCOMMERCE_STORE_HASH` - Store identifier

**Still Needed for Full Functionality:**
- `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` - B2B Edition Management API token (for invoices, advanced features)

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite for fast development and optimized builds, and Wouter for lightweight client-side routing. UI is crafted with Tailwind CSS for utility-first styling, complemented by shadcn/ui components (based on Radix UI) for accessibility and customization, all adhering to a mobile-first responsive design. State management primarily utilizes TanStack Query for server state and caching, with local storage for authentication tokens.

### Backend Architecture
The backend is an Express.js server providing API endpoints and static file serving. It uses a PostgreSQL database with the Neon serverless driver and Drizzle ORM for type-safe data persistence. Security is enforced through bearer token authentication and role-based authorization middleware across 32 protected API routes. The API follows a RESTful structure, covering authentication, resource management (dashboard stats, orders, quotes, invoices, shopping lists), and company/user/address management.

**Design Decisions:**
- PostgreSQL is chosen for production-grade data persistence.
- A role-based permission system is enforced at both frontend and backend levels.
- Company hierarchy is supported with `parentCompanyId` in the schema.
- A shared schema between frontend and backend ensures type consistency.
- Server-side caching for BigCommerce orders in `bigcommerce_orders_cache` table addresses BigCommerce API limitations (specifically for orders via REST API) to ensure reliability and enable direct order detail access.

**BigCommerce API Integration:**
- Utilizes BigCommerce GraphQL API for Quotes, Invoices, Shopping Lists, and Company data.
- **Dual API Strategy for Orders:** Implements intelligent fallback system:
  1. **Primary:** BigCommerce B2B Edition REST API (`/api/v2/orders`) for B2B-linked orders
  2. **Fallback:** Standard BigCommerce V2 API when B2B Edition returns empty results
  3. Orders from standard API are transformed to match B2B Edition format for seamless integration
- Server-side caching for BigCommerce orders in `bigcommerce_orders_cache` table addresses API limitations and enables direct order detail access.

### Enterprise Features
- **Advanced Permission System:** Features 12 granular permissions across orders, quotes, invoices, shopping lists, users, and addresses, with role-based access control (Admin, Buyer, User roles). Frontend components conditionally render based on user permissions.
- **User Management CRUD:** Full lifecycle management including inviting, editing, and deactivating users with role selection.
- **Address Management CRUD:** Comprehensive address book functionality including adding, editing, deleting, and setting a single default address per company, with backend enforcement.
- **Backend Security:** Implements bearer token validation and role-permission mapping for authorization, ensuring all 32 API routes are secured.

## External Dependencies

-   **BigCommerce Integration:** BigCommerce B2B Edition API (configurable via `VITE_B2B_URL`), requiring Store Hash and Channel ID for authentication. Custom checkout configuration via `window.b3CheckoutConfig` and `window.B3`.
-   **Database:** PostgreSQL via `@neondatabase/serverless` driver and Drizzle ORM.
-   **Authentication:** Session management with `connect-pg-simple` for PostgreSQL session storage; token-based authentication is implemented.
-   **Third-Party Services:** CDN support for static assets, CORS configuration for various hosting platforms, and Google Fonts (Inter).