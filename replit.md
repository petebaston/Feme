# BigCommerce B2B Buyer Portal

## Overview
This project is a production-ready headless B2B buyer portal designed for BigCommerce B2B Edition. It offers a comprehensive suite of enterprise-grade features including advanced order management, quoting workflows, an analytics dashboard, quick order pad, reorder templates, shopping list management, and robust user and address management. The portal integrates directly with the BigCommerce B2B API and features a modern React frontend with TypeScript, a responsive mobile-first design, and a minimalist aesthetic, aiming to provide a complete B2B e-commerce solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, and Wouter for client-side routing. UI is designed with Tailwind CSS and shadcn/ui components for a mobile-first, responsive, and accessible experience. State management uses TanStack Query for server state and caching, and local storage for authentication tokens.

**Mobile UX:**
- Sticky bottom tab bar replaces hamburger sidebar on mobile (Home, Orders, Invoices, More).
- "More" tab opens a bottom Sheet with additional nav items (My Orders, Addresses, User Management, Account Settings, Shop, Log out).
- Desktop sidebar remains unchanged (`hidden md:flex`).
- Orders and Invoices pages show card views on mobile (`md:hidden`), desktop table hidden on mobile (`hidden md:block`).
- Header is compact on mobile: SHOP link hidden, user avatar shows initials circle.
- Dashboard tiles, credit summary, and aged invoice cards use 2-column grids on mobile.
- Safe-area padding for iOS notch devices via `.safe-area-bottom` CSS class.

### Backend Architecture
The backend is an Express.js server providing API endpoints and static file serving. It uses a PostgreSQL database with the Neon serverless driver and Drizzle ORM for type-safe data persistence. Security is enforced through bearer token authentication and role-based authorization middleware across 32 protected API routes. The API follows a RESTful structure covering authentication, resource management (dashboard stats, orders, quotes, invoices, shopping lists), and company/user/address management.

**Design Decisions:**
- PostgreSQL is chosen for production-grade data persistence.
- A role-based permission system is enforced at both frontend and backend levels.
- Company hierarchy is supported with `parentCompanyId` in the schema.
- A shared schema between frontend and backend ensures type consistency.
- Server-side caching for BigCommerce orders in `bigcommerce_orders_cache` table addresses BigCommerce API limitations to ensure reliability and enable direct order detail access.
- **Invoice Caching:** TTL-based caching (5-minute validity) in `bigcommerce_invoices_cache` table. Cache-first strategy returns cached invoices immediately when fresh, only fetching from API when cache is stale or empty. Significantly reduces API calls and improves response times.

**BigCommerce API Integration:**
- Utilizes BigCommerce GraphQL API for Quotes, Invoices, Shopping Lists, and Company data.
- **Dual API Strategy for Orders:** Implements an intelligent fallback system:
  1. Primary: BigCommerce B2B Edition REST API for B2B-linked orders.
  2. Fallback: Standard BigCommerce V2 API when B2B Edition returns empty results.
  3. Orders from the standard API are transformed to match the B2B Edition format for seamless integration.
- **Invoice Management:** Uses BigCommerce Management Token for fetching invoices, with server-side filtering by `extraFields.Customer ID` to prevent cross-company data leakage. Implements paginated fetching for all invoices.
- **Order Extra Fields:** Fetched using the B2B REST API endpoint `GET /api/v3/io/orders?bcOrderId={orderId}&showExtra=true` for comprehensive details.
- **Users & Addresses:** Managed via B2B Edition Management API v3 (`/api/v3/io/users`, `/api/v3/io/addresses`), filtered by actual company ID, with cache-busting headers.
- **Authentication & Session Management:** Backend `api/auth/me` validates both JWT and BigCommerce tokens, and enriches the response with the user's B2B profile (firstName, lastName, phone) via `GET /api/v3/io/users/{userId}`. Returns a flat structure rather than a nested `user` object. Automatic logout occurs if the BigCommerce token is missing, with clear user messaging. "Remember me" functionality uses `sameSite: 'lax'` for refresh token cookies to work within iframe environments.
- **Account Settings Pre-population:** `/api/auth/me` now fetches the full B2B user profile and returns firstName/lastName/phone alongside JWT claims, so the Account Settings form correctly pre-populates on load. Role field capitalised for display.

### Enterprise Features
- **Advanced Permission System:** Features 12 granular permissions across various modules (orders, quotes, invoices, shopping lists, users, addresses), with role-based access control (Admin, Buyer, User roles).
- **User Management CRUD:** Full lifecycle management including inviting, editing, and deactivating users with role selection.
- **Address Management CRUD:** Comprehensive address book functionality including adding, editing, deleting, and setting a single default address per company.
- **Backend Security:** Implements bearer token validation and role-permission mapping for authorization, securing all API routes.

### Docker & Azure Deployment
- **Dockerfile:** Multi-stage build (Node 20 Alpine). Stage 1 installs all deps and runs `npm run build` with VITE_* build args (including `VITE_STORE_URL` and `VITE_PORTAL_URL`). Stage 2 copies `dist/` output, installs production-only deps, and runs `node dist/index.js`.
- **docker-compose.yml:** Local production testing with `.env` file for all environment variables.
- **AZURE_DEPLOY.md:** Step-by-step guide for deploying to Azure Container Apps via ACR. Covers build-time vs runtime variable separation.
- App listens on `0.0.0.0:5000` (PORT env var, default 5000).
- **VITE_STORE_URL:** Configurable storefront URL used in logout redirect, SHOP links, login page links. Defaults to `https://feme-limited-sandbox.mybigcommerce.com`.
- **VITE_PORTAL_URL:** Configurable portal URL used in `client/index.html` for B2B Edition SSO redirect. Falls back to `window.location.origin`.
- **Cart Removal:** mini-cart.tsx, checkout.tsx, quick-order.tsx, products.tsx deleted; all cart API routes removed; no cart icon in header.
- **PRODUCTION_DEPLOY.md:** Comprehensive production go-live guide covering Azure Database for PostgreSQL provisioning, BigCommerce Dinsour theme activation with B2B portal script tag, Account→B2B Portal navigation rename, full environment variable reference, go-live checklist, and post-deployment verification steps.

## External Dependencies

-   **BigCommerce Integration:** BigCommerce B2B Edition API, requiring Store Hash and Channel ID. Custom checkout configuration via `window.b3CheckoutConfig` and `window.B3`.
-   **Database:** PostgreSQL via `@neondatabase/serverless` driver and Drizzle ORM.
-   **Authentication:** Session management with `connect-pg-simple` for PostgreSQL session storage.
-   **Third-Party Services:** CDN support for static assets, CORS configuration, and Google Fonts (Inter).