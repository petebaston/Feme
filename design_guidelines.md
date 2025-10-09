# B2B Portal - Design Guidelines (feme.com Style)

## Design Approach
Following feme.com's clean, modern e-commerce aesthetic with emphasis on product imagery, white space, and contemporary typography. Professional yet approachable B2B commerce experience.

---

## Color Palette

**Primary Colors:**
- Background: #FFFFFF (white)
- Surface/Card: #F8F8F8 (light gray)
- Primary Brand: #000000 (black)
- Primary Hover: #333333 (dark gray)
- Accent: #E8E8E8 (subtle gray)

**Semantic Colors:**
- Success: #10B981 (green)
- Warning: #F59E0B (amber)
- Error: #EF4444 (red)
- Info: #3B82F6 (blue)

**Text:**
- Primary: #000000
- Secondary: #666666
- Tertiary: #999999
- Inverse: #FFFFFF

**Borders:**
- Default: #E5E5E5
- Hover: #D4D4D4
- Focus: #000000

---

## Typography

**Font Stack:** System fonts for crisp rendering
- Primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Headings: 600 weight (font-semibold)
- Body: 400 weight (font-normal)
- Bold: 500 weight (font-medium)

**Sizes:**
- Hero: 36-48px (text-4xl/5xl)
- H1: 28-32px (text-3xl/4xl)
- H2: 24px (text-2xl)
- H3: 18-20px (text-lg/xl)
- Body: 14-16px (text-sm/base)
- Small: 12-13px (text-xs/sm)

---

## Layout & Spacing

**Container:**
- Max-width: 1280px
- Padding: px-4 (mobile), px-6 (tablet), px-8 (desktop)

**Spacing Scale:** 4, 8, 12, 16, 24, 32, 48, 64px
- Tight: space-y-4
- Normal: space-y-6
- Loose: space-y-8

**Grid:**
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3-4 columns
- Gap: gap-4 to gap-6

---

## Components

### Navigation
**Header (Sticky):**
- Height: h-16
- Background: white with subtle border-b
- Logo left, navigation center, user/cart right
- Clean, minimal design

**Mobile Navigation:**
- Hamburger menu → full-screen overlay
- Large touch targets (min 44px)
- Bottom navigation bar for key actions

### Cards & Containers
**Product/Order Cards:**
- Background: white
- Border: 1px solid #E5E5E5
- Rounded: rounded-lg (8px)
- Padding: p-4 to p-6
- Hover: subtle shadow lift

**Stats Cards:**
- Clean number display (text-3xl, font-semibold)
- Label below (text-sm, text-gray-600)
- Minimal borders or borderless
- Icon optional (top-right corner)

### Buttons
**Primary:**
- bg-black text-white
- Rounded: rounded-md
- Padding: px-6 py-3 (desktop), px-4 py-2.5 (mobile)
- Hover: bg-gray-800

**Secondary:**
- Border: border-2 border-black
- Text: text-black
- Background: transparent
- Hover: bg-black text-white

**Sizes:**
- Small: h-9 px-4 text-sm
- Medium: h-11 px-6 text-base
- Large: h-12 px-8 text-base

### Forms
**Input Fields:**
- Border: border border-gray-300
- Rounded: rounded-md
- Height: h-11 (mobile-friendly)
- Focus: ring-2 ring-black
- Background: white
- Placeholder: text-gray-400

**Labels:**
- Above input
- text-sm font-medium
- mb-2

### Tables
**Desktop:**
- Clean rows with subtle borders
- Hover: bg-gray-50
- Headers: font-medium, border-b-2

**Mobile:**
- Transform to stacked cards
- Key info prominent
- Actions in dropdown

### Status Badges
**Style:**
- Rounded: rounded-full
- Padding: px-3 py-1
- text-xs font-medium
- Inline-block

**Colors:**
- Pending: bg-yellow-100 text-yellow-800
- Approved: bg-green-100 text-green-800
- Processing: bg-blue-100 text-blue-800
- Shipped: bg-purple-100 text-purple-800
- Cancelled: bg-gray-100 text-gray-800

---

## Mobile Responsiveness

**Breakpoints:**
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px

**Mobile-First Optimizations:**
- Touch targets: min 44px height
- Readable font sizes (minimum 14px)
- Simplified navigation
- Collapsible sections
- Bottom navigation for key actions
- Horizontal scroll for wide tables (with cards on mobile)

**Responsive Patterns:**
- Sidebar: Hidden on mobile, overlay when opened
- Grid: 1 col (mobile) → 2 col (tablet) → 3-4 col (desktop)
- Tables: Cards (mobile) → Table (desktop)

---

## Custom Fields & Data Display

**Payment Terms:**
- Display as badges or chips
- Examples: "Net 30", "1-30 days", "30-60 days", "60-90 days", "90+ days"
- Visual representation with icons or colors
- Grouping in stats and filters

**Custom Field Patterns:**
- Key-value pairs in grid layout
- 2 columns on desktop, 1 on mobile
- Label: text-sm text-gray-600
- Value: text-base font-medium

---

## Visual Hierarchy

**Emphasis Order:**
1. Primary actions (black buttons)
2. Key metrics/numbers (large, bold)
3. Content headings
4. Body text
5. Supporting details

**Whitespace:**
- Generous padding in cards (p-6 desktop, p-4 mobile)
- Section spacing (space-y-8 to space-y-12)
- Line height: leading-relaxed for readability

---

## Accessibility

- WCAG AA contrast (4.5:1 for text)
- Focus visible on all interactive elements
- Skip to main content link
- Semantic HTML (header, nav, main, footer)
- ARIA labels for icons
- Keyboard navigation support

---

**Design Philosophy:** Clean, minimal, product-focused design inspired by modern e-commerce. Black and white foundation with subtle grays, clear typography, generous whitespace, and mobile-first responsiveness.