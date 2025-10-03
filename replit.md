# BigCommerce B2B Buyer Portal

## Overview

This is a headless B2B buyer portal built for BigCommerce B2B Edition. The application provides a comprehensive interface for B2B customers to manage orders, quotes, company settings, and user roles. It's designed as a production-ready, customizable solution that integrates natively with BigCommerce's B2B Edition APIs.

The portal features a modern React frontend with TypeScript, responsive design using Tailwind CSS and shadcn/ui components, and is optimized for static hosting with CDN support.

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
- Session-based authentication (prepared for JWT tokens in production)

**Data Layer:**
- In-memory storage implementation (`MemStorage` class) for demo/development
- Drizzle ORM configured for PostgreSQL (Neon serverless) for production use
- Database schema defined in `shared/schema.ts` with tables for users, companies, orders, and quotes

**API Structure:**
- RESTful endpoints under `/api/` prefix
- Authentication endpoints (`/api/auth/login`)
- Resource endpoints for dashboard stats, orders, quotes, company data
- CORS configuration for BigCommerce storefront integration

**Design Decisions:**
- Dual storage system allows local development without database
- Demo data initialization in MemStorage for quick setup
- Separation of development and production server configurations
- Shared schema between frontend and backend for type consistency

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