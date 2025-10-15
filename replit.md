# BigCommerce B2B Buyer Portal

## Overview
This project is a production-ready headless B2B buyer portal designed for BigCommerce B2B Edition (store: pyrenapwe2). It offers a comprehensive suite of enterprise-grade features, including advanced order management, quoting workflows, an analytics dashboard, a quick order pad, reorder templates, shopping list management, and robust user and address management. The portal integrates directly with the BigCommerce B2B API and features a modern React frontend with TypeScript, a responsive mobile-first design using Tailwind CSS and shadcn/ui, and is optimized for deployment on Replit. The project aims to provide a complete B2B e-commerce solution with a minimalist design aesthetic.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- Relies on BigCommerce REST API for Orders, which required a robust server-side caching solution due to observed API reliability issues (404s, inconsistent results) and case-sensitivity for status values.

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