# BigCommerce B2B Buyer Portal

## Overview
This project is a production-ready headless B2B buyer portal designed for BigCommerce B2B Edition (store: pyrenapwe2). It offers a comprehensive suite of enterprise-grade features, including advanced order management, quoting workflows, an analytics dashboard, a quick order pad, reorder templates, shopping list management, and robust user and address management. The portal integrates directly with the BigCommerce B2B API and features a modern React frontend with TypeScript, a responsive mobile-first design using Tailwind CSS and shadcn/ui, and is optimized for deployment on Replit. The project aims to provide a complete B2B e-commerce solution with a minimalist design aesthetic.

## Test Credentials
**Email:** afrowholesaledirect@FEME.com
**Password:** Beauty_F3m3!
**Company:** TEST Affro Wholesale Direct Ltd (Company ID: 9685502, Customer ID: FEM01)

## User Preferences
Preferred communication style: Simple, everyday language.

## Known Issues & Setup Requirements

### Orders System - ✅ RESOLVED (Nov 10, 2025)
**Background:** BigCommerce B2B Edition has a completely separate orders system from the regular BigCommerce store. Orders placed through regular BigCommerce checkout are NOT automatically visible in B2B Edition.

**Solution Implemented:** Dual API fallback system with enhanced customer discovery
1. Portal first attempts to fetch orders from B2B Edition API
2. If B2B Edition returns 0 orders, automatically falls back to standard BigCommerce V2 API
3. **CRITICAL:** Standard API orders are filtered to only include the current company's customer IDs (prevents cross-company data leakage)
4. Standard API orders are transformed to match B2B Edition format (currency, status, etc.)
5. All orders (from either source) are cached in PostgreSQL for reliability

**Enhanced Customer Discovery (Nov 10, 2025):**
- **Problem**: B2B API may only return subset of company users (e.g., 1 user when multiple exist)
- **Solution**: Dual-strategy customer discovery system:
  - **Strategy A (Seeded)**: If B2B users exist → discover company identifiers from their orders → find ALL customers using those identifiers
  - **Strategy B (Fallback)**: If NO B2B users → match by company name → discover identifiers → find all customers
- **Security**: Only matches company identifiers validated from known company customers or official company name
- **Result**: Company Orders finds multiple users (e.g., customers 433, 29) even when B2B API returns limited user data

**Company Filtering Logic:**
- Discovers company identifiers (current ID + historical IDs like "8810354") from validated sources
- Filters standard API orders where `order.customer_id` matches discovered customer IDs
- Ensures users only see their company's orders, preventing cross-company data leakage

**Current Status:** ✅ Working - Portal correctly discovers multiple company customers and filters orders (e.g., 23 total orders → 10 orders for company 9685502 with 2 customers).

**API Credentials Required:**
- `BIGCOMMERCE_ACCESS_TOKEN` - Standard BigCommerce API access token (for fallback)
- `BIGCOMMERCE_CLIENT_ID` - OAuth client ID
- `BIGCOMMERCE_CLIENT_SECRET` - OAuth client secret
- `BIGCOMMERCE_STORE_HASH` - Store identifier (e.g., "pyrenapwe2")

### Invoices System - ✅ RESOLVED (Nov 10, 2025)
**Previous Issues:** 
1. Getting 403 "Invalid access token" when attempting different authentication methods
2. Cross-company data leakage showing invoices from ALL companies
3. BigCommerce API ignoring `companyId` parameter when using management token

**Root Causes (Confirmed via Testing):** 
1. The `/api/v3/io/ip/invoices` endpoint **ONLY accepts management tokens** - buyer storefront tokens return `403 "Invalid token"`
2. BigCommerce **IGNORES the `companyId` parameter** when using management tokens - returns ALL invoices
3. GraphQL `getCompany()` method returns basic data WITHOUT `extraFields` (no Customer ID)
4. Need to use REST API `getCompanyDetails()` to get full company data WITH `extraFields.Customer ID`

**FINAL WORKING SOLUTION (Architect-Approved):**
- **Authentication:** Management Token (`X-Auth-Token`) - buyer tokens don't work
- **Company Customer ID:** Fetched via `getCompanyDetails(companyId)` REST API to get `extraFields.Customer ID` (e.g., "FEM01")
- **Invoice Filtering:** Server-side filtering by matching `invoice.extraFields.Customer === company.extraFields.Customer ID`
- **Implementation:**
  1. Fetch ALL invoices using management token
  2. Get company's Customer ID from `getCompanyDetails()` REST endpoint
  3. Enrich each invoice with full details (including extraFields)
  4. Filter where `invoice.extraFields.Customer` matches company's Customer ID
  5. Return only matching invoices
- **Security:** Defense-in-depth validation at 3 endpoints (list, detail, PDF) - blocks access if Customer IDs don't match
- **PDF Download:** Uses `/download-pdf` endpoint (per official documentation)
- **PDF Preview:** Expandable inline PDF preview in invoices table

**Current Status:** ✅ Production-ready - Portal filters invoices by matching Customer ID in extraFields. Architect confirmed security is sound.

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

### Authentication & Session Management - ✅ RESOLVED (Nov 19, 2025)
**Previous Issues:**
1. Users appeared "logged in" but received errors accessing orders/invoices
2. BigCommerce token expired but JWT session token remained valid
3. "Remember me" didn't work - refresh token cookie not sent in Replit's iframe
4. No clear messaging when session expired

**Root Causes:**
1. `/api/auth/me` only validated JWT token, not BigCommerce token existence
2. BigCommerce tokens expire independently from JWT tokens (BigCommerce API limitation)
3. Refresh token cookie used `sameSite: 'strict'` which browsers block in iframe contexts (Replit environment)
4. No automatic logout when BigCommerce token was missing

**Solution Implemented:**
- **Backend `/api/auth/me` Validation**: Now checks both JWT token AND BigCommerce token existence in database
- **Automatic Logout**: System detects `reason: "bigcommerce_token_missing"` and immediately redirects to login
- **Fixed Refresh Loop**: App.tsx skips token refresh attempt when BigCommerce token is missing (prevents infinite loop)
- **User Messaging**: Login page displays "Session Expired" message when redirected with `?expired=true` parameter
- **Refresh Token Cookie Fix**: Changed `sameSite` from `'strict'` to `'lax'` to enable cookie transmission in Replit's iframe environment

**"Remember Me" Functionality:**
- ✅ "Remember me" extends JWT session to 30 days (vs 15 minutes without)
- ✅ Refresh token cookie now works in Replit iframe (`sameSite: 'lax'` instead of `'strict'`)
- ✅ Cookie security maintained: `httpOnly: true`, `secure: true` (production), 30-day expiration
- ❌ BigCommerce tokens still expire independently (~7-14 days) - API limitation, cannot be refreshed
- **Result**: JWT sessions persist for 30 days, but users must re-login when BigCommerce token expires

**Current Status:** ✅ Production-ready - System now properly detects expired BigCommerce tokens, auto-logs out users with clear messaging, and "Remember Me" functionality works correctly in iframe environments.

### Required Secret Configuration
**Currently Configured:** ✅
- `BIGCOMMERCE_ACCESS_TOKEN` - Standard BigCommerce API access token
- `BIGCOMMERCE_CLIENT_ID` - OAuth client ID
- `BIGCOMMERCE_CLIENT_SECRET` - OAuth client secret
- `BIGCOMMERCE_STORE_HASH` - Store identifier
- `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` - B2B Edition Management API token

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