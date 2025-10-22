# Design System - B2B Portal Redesign

Based on client screenshots, this document outlines the design system for the B2B portal redesign.

## Color Palette

### Primary Colors
- **Brand Pink**: `#E91E63` (FEME logo)
- **Black**: `#000000` (sidebar background, primary text, active states, buttons)
- **White**: `#FFFFFF` (main background, card backgrounds)

### Status Colors
- **Completed**: `bg-[#C4D600]` or `bg-yellow-500/20` with `text-yellow-800`
- **Awaiting Payment**: `bg-orange-500` with `text-white`
- **Awaiting Fulfillment**: `bg-blue-400` with `text-white`
- **Partially Shipped**: `bg-blue-600` with `text-white`
- **Overdue**: `bg-red-600` with `text-white`
- **Paid**: `bg-green-500` with `text-white`

### UI Colors
- **Search Background**: `bg-gray-100`
- **Table Borders**: `border-gray-200`
- **Text Gray**: `text-gray-600` for secondary text
- **Blue Highlight**: `bg-blue-100/50` for special backgrounds (Account Settings current password)

## Typography

### Page Titles
- **Large titles**: `text-3xl font-bold text-black`
- **With blue background** (Invoices, Account settings): Add `bg-blue-600 text-white px-3 py-1 inline-block`

### Body Text
- **Regular**: `text-base text-gray-900`
- **Secondary**: `text-sm text-gray-600`
- **Labels**: `text-sm font-medium text-gray-700`

## Layout

### Sidebar
- **Background**: Black (`bg-black`)
- **Text**: White (`text-white`)
- **Active Item**: Darker black or same black with white text
- **Width**: `w-64`
- **Items**:
  1. My orders
  2. Company orders
  3. Invoices
  4. Addresses
  5. User management
  6. Account settings

### Main Content
- **Background**: White
- **Padding**: `p-6` or `p-8`
- **Max Width**: Full width with appropriate padding

## Components

### Tables
- **Style**: Clean with horizontal borders
- **Header**: Bold text, sortable columns with down arrow
- **Rows**: `hover:bg-gray-50` on hover
- **Borders**: `border-gray-200`

### Status Badges
- **Shape**: Rounded pills (`rounded-full` for orders, `rounded-md` for addresses)
- **Padding**: `px-3 py-1`
- **Font**: `text-xs font-medium`

### Buttons
- **Primary**: Black background, white text
- **Secondary**: White background, black border
- **Size**: Various (`sm`, `md`)

### Search Bar
- **Background**: Light gray (`bg-gray-100`)
- **Border**: Subtle or none
- **Icon**: Magnifying glass on left
- **Height**: `h-10` or `h-11`

### Filter Icon
- Three horizontal lines (hamburger-style)

### Pagination
- **Position**: Bottom right
- **Style**: "Rows per page: 10" with dropdown, "1–8 of 8" with navigation arrows

## Page-Specific Designs

### My Orders Table
Columns:
1. Order ↓ (sortable)
2. Company
3. PO / Reference
4. Grand total
5. Order status (with colored badges)
6. Created on

### Company Orders Table
Same as My Orders, plus:
- **Placed by** column showing user name

### Invoices Table
Columns:
1. Checkbox (for bulk actions)
2. Expand arrow
3. Invoices ↓
4. Company
5. Order
6. Invoice date
7. Due date (red text if overdue)
8. Invoice total
9. Amount due
10. Amount to pay (input field)
11. Status (badge)
12. Action (three dots menu)

Top bar:
- "Open: £X | Overdue: £X" (Overdue in red)
- "EXPORT FILTERED AS CSV" button

### Addresses Page
- **Layout**: Card-based grid
- **Card**: White with border
- **Badges**: Green for "Default shipping" and "Default billing"
- **Actions**: "SET AS DEFAULT" button, edit icon, delete icon

### Account Settings Page
- **Layout**: Form with stacked inputs
- **Inputs**: Full-width, with labels above
- **Disabled Fields**: Gray background for Company user, Company, Role
- **Current Password**: Light blue background highlight
- **Submit Button**: Black "SAVE UPDATES" button at bottom

## Additional Notes
- All pages have consistent search bar and filter icon at top
- FEME logo in top left (pink/magenta)
- User dropdown in top right with "HOME" and "CART" links
- Clean, minimal design with lots of white space
- Mobile-responsive where applicable
