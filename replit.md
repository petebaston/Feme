# BigCommerce B2B Buyer Portal

## Overview

This is a production-ready headless B2B buyer portal built for BigCommerce B2B Edition (store: pyrenapwe2). The application provides enterprise-grade capabilities including comprehensive order management, advanced quote workflows, analytics dashboard, quick order pad with product search, reorder templates, shopping list management, user and address management, and direct BigCommerce B2B API integration.

The portal features a modern React frontend with TypeScript, responsive mobile-first design using Tailwind CSS and shadcn/ui components, real-time BigCommerce B2B API integration, and is optimized for production deployment on Replit with feme.com's black/white/gray minimalist design aesthetic.

**18 out of 20 enterprise features completed** from the comprehensive B2B buyer portal roadmap.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type safety and modern component development
- Vite as the build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing

**UI Framework:**
- Tailwind CSS for utility-first styling with custom design tokens
- shadcn/ui component library (Radix UI primitives) for accessible, customizable components
- Custom theming system with CSS variables for colors, shadows, and spacing
- Mobile-first responsive design approach

**State Management:**
- TanStack Query (React Query) for server state management, caching, and data fetching
- Local storage for authentication tokens and user data
- No global state management library (relies on React Query and local state)

**Component Organization:**
- Page components in `client/src/pages/` (dashboard, orders, quotes, company, login)
- Reusable UI components in `client/src/components/ui/` (shadcn/ui components)
- Business logic components in `client/src/components/b2b/` (order cards, quote cards)
- Layout components in `client/src/components/layout/` (header, sidebar)

### Backend Architecture

**Server Setup:**
- Express.js server for API endpoints and static file serving
- Two server modes: development (`server/index.ts`) and production (`server/production.ts`)
- Bearer token authentication with role-based authorization middleware

**Data Layer:**
- PostgreSQL database with Neon serverless driver for production persistence
- Drizzle ORM for type-safe queries and schema management
- Database schema in `shared/schema.ts` with tables for users, companies, orders, quotes, addresses, shopping lists
- DatabaseStorage implementation (`server/storage.ts`) with full CRUD operations
- Demo data seeding for development and testing

**Security Architecture:**
- Authentication middleware (`server/middleware/auth.ts`) - validates bearer tokens from Authorization header only
- Authorization middleware - role-based permission checks (admin, buyer, user roles)
- 32 protected API routes with granular permission enforcement
- Frontend integration sends auth tokens in Authorization headers for all requests

**API Structure:**
- RESTful endpoints under `/api/` prefix (all protected with authentication)
- Authentication endpoints (`/api/auth/login`)
- Resource endpoints for dashboard stats, orders, quotes, invoices, shopping lists
- Company management (company data, users, addresses, hierarchy)
- User management (invite, edit, deactivate)
- Address management (add, edit, delete, set default)
- CORS configuration for BigCommerce storefront integration

**Design Decisions:**
- PostgreSQL for production-grade data persistence and reliability
- Role-based permission system enforced at both frontend and backend layers
- Company hierarchy supports parent-child relationships with multi-company access
- Shared schema between frontend and backend for type consistency
- Demo tokens for development (production-ready for JWT upgrade)

## Implemented Features (18 of 20)

### 1. Quick Order Pad with CSV Upload
**SKU-based Rapid Ordering:**
- Multi-row SKU and quantity entry interface
- CSV bulk upload for large orders
- CSV template download for easy formatting
- Paste support from Excel/spreadsheets
- Dynamic row addition/removal
- Add to cart functionality

**Product Search Integration:**
- Real-time product search with autocomplete
- Search by product name or SKU
- Dropdown results with product details
- Click-to-add products to order rows
- Integrated with BigCommerce products API

### 2. Quote Workflows
**Quote Creation:**
- Request Quote dialog with title and notes
- Backend POST /api/quotes endpoint
- Company and user context auto-filled
- Status tracking (draft, open, approved, rejected)

**Quote Conversion:**
- Convert approved quotes to orders
- One-click checkout from quote detail
- Backend POST /api/quotes/:id/checkout endpoint
- Cache invalidation for quotes and orders

### 3. Analytics Dashboard
**Key Metrics:**
- Total Spent with order count
- Average Order Value calculation
- Total Orders with status breakdown
- Active Quotes tracking

**Visualizations:**
- Monthly spending trend with bar charts
- Time range selector (7/30/90/365 days)
- Order status breakdown (Completed, Pending)
- Payment status tracking (Unpaid Invoices)
- Responsive metric cards

### 4. Reorder Templates
**Template Management:**
- Save current Quick Order items as named templates
- Load templates with one click
- Delete templates functionality
- localStorage persistence
- Template popover UI with item counts

### 5. Shopping Lists CRUD
**Full Lifecycle:**
- Create new shopping lists with names
- View all lists with item counts
- Edit list names and items
- Delete lists with confirmation
- Add to cart from lists

### 6. Invoice Management
**PDF Download:**
- Download invoices as PDF
- Backend PDF generation endpoint
- Auth token integration
- Proper Content-Disposition headers

**Export Functionality:**
- Export invoice data to CSV
- Custom filename with invoice number

### 7. Order Management
**Enhanced Features:**
- Display custom ERP fields (extraFields)
- Order line items with SKU, name, quantity, price
- Export orders to CSV
- Currency formatting with £ symbol
- Mobile-optimized order cards

### 8. Company Page Enhancement
**Financial Overview:**
- Prominent credit limit card
- Payment terms display
- Pricing tier indicators
- Credit status visualization
- Mobile-responsive layout

### 9. User Management
**Complete CRUD:**
- Invite new users with email and role
- Edit user details and permissions
- Deactivate users with confirmation
- Role-based visibility controls

### 10. Address Book Management
**Full CRUD Operations:**
- Add new addresses with validation
- Edit existing addresses
- Delete addresses with confirmation
- Set default address (single default enforced)

### 11. Currency Formatting
**BigCommerce Money Object:**
- Support for £ symbol (GBP)
- Configurable decimal places
- Thousands separator
- Currency location (left/right)
- Utility function for consistent formatting

### 12. Mobile Optimization
**Responsive Design:**
- Mobile-first Tailwind CSS approach
- Responsive breakpoints (sm, md, lg)
- Touch-friendly interfaces
- Optimized navigation for small screens

### 13. Quote Approval Workflows
**Approval UI:**
- Approve/Reject buttons on quote details
- Status badge visualization
- Permission-based controls
- Toast notifications for actions

### 14. Product Search
**SKU Autocomplete:**
- Search endpoint /api/products/search
- Query-based filtering
- Product name, SKU, price display
- Integrated into Quick Order page

### 15. Remaining Features (2 of 20 not implemented)
**Company Hierarchy:** Multi-company switching and parent-child relationships (complex backend work required)
**Saved Carts:** Cart persistence and restoration (BigCommerce API limitations)

## Enterprise Features
**Multi-Company Access:**
- Parent-child company relationships with hierarchical structure
- Company switcher UI for navigating between accessible companies
- User access to multiple companies within the same organization
- Secure company switching with permission validation

**Database Schema:**
- `parentCompanyId` field establishes hierarchy relationships
- Recursive queries for retrieving company trees
- Access control enforced at backend for company-specific data

### Advanced Permission System
**12 Granular Permissions:**
- **Orders:** view_orders, create_orders
- **Quotes:** view_quotes, create_quotes, manage_quotes
- **Invoices:** view_invoices
- **Shopping Lists:** view_shopping_lists, manage_shopping_lists
- **Users:** manage_users (invite, edit, deactivate)
- **Addresses:** manage_addresses (add, edit, delete, set default)
- **Company:** view_company, manage_company, switch_companies

**Role-Based Access Control:**
- Admin role: Full access to all permissions
- Buyer role: Order/quote management, view company data
- User role: View-only access to orders and quotes

**UI Permission Controls:**
- Frontend components conditionally render based on user permissions
- Action buttons, dialogs, and forms hidden for unauthorized users
- Permission utility functions and React hooks for easy integration

### User Management CRUD
**Complete User Lifecycle:**
- Invite new users with email, name, role selection
- Edit existing users (name, role updates)
- Deactivate users (soft delete, preserves data)
- User list with role indicators and action buttons

**UI Components:**
- InviteUserDialog: Form with email, first/last name, role dropdown
- EditUserDialog: Pre-populated form for user updates
- DeactivateUserDialog: Confirmation dialog with user details
- Permission-based visibility (manage_users required)

### Address Management CRUD
**Full Address Book:**
- Add new addresses with complete address fields
- Edit existing addresses (all fields editable)
- Delete addresses with confirmation
- Set default address (enforced single default)

**Default Address Logic:**
- Backend enforcement: Only one default per company
- Automatic default handling when deleting default address
- Visual indicators for default address in UI
- Set default action available on all addresses

**UI Components:**
- AddAddressDialog: Full address form with validation
- EditAddressDialog: Pre-populated address editing
- DeleteAddressDialog: Confirmation with address summary
- Permission-based controls (manage_addresses required)

### Backend Security Implementation
**Authentication Layer:**
- Bearer token validation (Authorization header only)
- User lookup from database
- Token-to-user mapping with demo tokens (JWT-ready)
- 401 responses for missing/invalid authentication

**Authorization Layer:**
- Permission-based route protection
- Role-permission mapping validation
- 403 responses for insufficient permissions
- Middleware composition (authenticate + authorize)

**Protected Endpoints:**
- All 32 API routes secured with authentication
- Granular permission checks per endpoint
- No query parameter identity spoofing
- Frontend token integration in all requests

### External Dependencies

**BigCommerce Integration:**
- BigCommerce B2B Edition API (configurable via `VITE_B2B_URL`)
- Store Hash and Channel ID required for API authentication
- B2B client wrapper (`client/src/lib/b2b-client.ts`) for API communication
- Custom checkout configuration through `window.b3CheckoutConfig` and `window.B3`

**Database:**
- PostgreSQL (via Neon serverless driver `@neondatabase/serverless`)
- Drizzle ORM for type-safe database queries and migrations
- Connection pooling through Neon's serverless adapter

**Authentication:**
- Session management with `connect-pg-simple` for PostgreSQL session storage
- Token-based authentication ready for production (currently using demo tokens)
- LocalStorage for client-side session persistence

**Third-Party Services:**
- CDN support for static assets (configurable via `VITE_ASSETS_ABSOLUTE_PATH`)
- CORS configuration for multiple hosting platforms (Replit, Vercel, Netlify)
- Font hosting through Google Fonts (Inter font family)

**Development Tools:**
- Replit-specific plugins for development (`@replit/vite-plugin-runtime-error-modal`, cartographer, dev-banner)
- TypeScript for type checking across the entire codebase
- ESBuild for server-side bundling in production

**Build & Deployment:**
- Separate Vite configurations for development and production
- Production build with code splitting (vendor, router, UI, query, utils chunks)
- Terser minification for production builds
- Support for multiple hosting platforms with environment-specific configurations