# 🎯 Best Practices Implementation Guide

This document outlines all the industry best practices implemented in this B2B portal application.

---

## 📚 Table of Contents

1. [Backend Best Practices](#backend-best-practices)
2. [Frontend Best Practices](#frontend-best-practices)
3. [Security Best Practices](#security-best-practices)
4. [Testing Best Practices](#testing-best-practices)
5. [Performance Best Practices](#performance-best-practices)
6. [DevOps Best Practices](#devops-best-practices)

---

## Backend Best Practices

### 1. **Structured Logging (Winston)**
**File:** `server/logger.ts`

```typescript
// ✅ Best Practice: Use structured logging with different levels
logger.info('User logged in', { userId, email });
logger.error('Database error', { error: error.message, stack: error.stack });

// ✅ Best Practice: Different log levels for environments
// Development: debug level
// Production: warn level
```

**Benefits:**
- Easier debugging in production
- Better log aggregation and searching
- Performance insights

### 2. **Comprehensive Error Handling**
**File:** `server/errors.ts`

```typescript
// ✅ Best Practice: Custom error classes
class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

// ✅ Best Practice: Async error wrapper (no try-catch needed)
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await storage.getUserById(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json(user);
}));
```

**Benefits:**
- Consistent error responses
- Cleaner code (no try-catch everywhere)
- Better error tracking

### 3. **Input Validation with Zod**
**File:** `server/validation.ts`

```typescript
// ✅ Best Practice: Schema-based validation
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

// ✅ Best Practice: Validation middleware
app.post('/api/users', validate(registerSchema), handler);
```

**Benefits:**
- Type-safe validation
- Clear error messages
- Prevents invalid data

### 4. **Caching with Proper Invalidation**
**File:** `server/utils/cache.ts`

```typescript
// ✅ Best Practice: In-memory cache with TTL
const cached = cache.get<User[]>(cacheKeys.users(companyId));
if (cached) return cached;

const users = await storage.getCompanyUsers();
cache.set(cacheKeys.users(companyId), users, 5 * 60 * 1000);

// ✅ Best Practice: Pattern-based invalidation
cache.invalidate(cacheKeys.users(companyId)); // Clear specific cache
cache.invalidate(/^users:/); // Clear by pattern
```

**Benefits:**
- Reduced database queries
- Faster API responses
- Smart cache invalidation

### 5. **Pagination Utilities**
**File:** `server/utils/pagination.ts`

```typescript
// ✅ Best Practice: Consistent pagination
const { limit, offset } = getPaginationSQL({ page, limit });
const users = await db.select().from(users).limit(limit).offset(offset);

const response = buildPaginatedResponse(users, total, { page, limit });
// Returns: { data, pagination: { page, limit, total, hasNext, hasPrev } }
```

**Benefits:**
- Consistent API responses
- Better performance
- User-friendly navigation

### 6. **Health Check Endpoints**
**File:** `server/health.ts`

```typescript
// ✅ Best Practice: Health check endpoints
GET /health - Quick health status
GET /ready - Readiness check (database connection, env vars)
GET /alive - Liveness check (server is responsive)
```

**Benefits:**
- Kubernetes/Docker compatibility
- Easy monitoring
- Deployment validation

---

## Frontend Best Practices

### 1. **Error Boundaries**
**File:** `client/src/components/error-boundary.tsx`

```typescript
// ✅ Best Practice: Graceful error handling
<ErrorBoundary fallback={<CustomErrorUI />}>
  <App />
</ErrorBoundary>
```

**Benefits:**
- App doesn't crash completely
- Better user experience
- Error tracking

### 2. **Loading States with Skeletons**
**Used throughout:** All list pages

```typescript
// ✅ Best Practice: Skeleton loaders instead of spinners
{isLoading ? (
  <Skeleton className="h-20" />
) : (
  <ActualContent />
)}
```

**Benefits:**
- Better perceived performance
- Users know what's loading
- Reduced layout shift

### 3. **Type-Safe Forms with Zod + React Hook Form**

```typescript
// ✅ Best Practice: Schema-based form validation
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(createUserSchema),
});
```

**Benefits:**
- Type safety
- Less boilerplate
- Consistent validation

### 4. **Optimistic UI Updates**

```typescript
// ✅ Best Practice: Update UI immediately, rollback on error
const mutation = useMutation({
  mutationFn: updateUser,
  onMutate: async (newUser) => {
    await queryClient.cancelQueries({ queryKey: ['users'] });
    const previous = queryClient.getQueryData(['users']);
    queryClient.setQueryData(['users'], newUser);
    return { previous };
  },
  onError: (err, newUser, context) => {
    queryClient.setQueryData(['users'], context.previous);
  },
});
```

**Benefits:**
- Instant feedback
- Better UX
- Feels faster

---

## Security Best Practices

### 1. **Authentication Security**
**File:** `server/auth.ts`

```typescript
// ✅ Best Practice: Separate access and refresh tokens
const accessToken = generateAccessToken(payload); // 15 min expiry
const refreshToken = generateRefreshToken(payload); // 7 day expiry

// ✅ Best Practice: HTTP-only cookies for refresh tokens
res.cookie('refreshToken', refreshToken, {
  httpOnly: true, // Not accessible via JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### 2. **Password Security**

```typescript
// ✅ Best Practice: Bcrypt with 12 rounds
const hashedPassword = await bcrypt.hash(password, 12);

// ✅ Best Practice: Strong password requirements
password: z.string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number')
```

### 3. **Rate Limiting**
**File:** `server/index.ts`

```typescript
// ✅ Best Practice: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 auth attempts per window
  skipSuccessfulRequests: true,
});
```

### 4. **Security Headers (Helmet)**

```typescript
// ✅ Best Practice: Security headers
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  // ... other security headers
}));
```

### 5. **Input Sanitization**

```typescript
// ✅ Best Practice: Sanitize all inputs
const sanitizedEmail = sanitizeEmail(email); // lowercase + trim
const sanitizedString = sanitizeString(input); // trim + normalize spaces
```

---

## Testing Best Practices

### 1. **Unit Tests**
**File:** `server/__tests__/validation.test.ts`

```typescript
// ✅ Best Practice: Test validation schemas
describe('registerSchema', () => {
  it('should reject weak passwords', () => {
    expect(() => registerSchema.parse({ password: 'weak' })).toThrow();
  });
});
```

### 2. **Component Tests**
**File:** `client/src/components/__tests__/error-boundary.test.tsx`

```typescript
// ✅ Best Practice: Test error scenarios
it('should render error UI when child throws', () => {
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});
```

### 3. **Test Configuration**
**File:** `jest.config.js`

```javascript
// ✅ Best Practice: Coverage thresholds
coverageThresholds: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

**Commands:**
```bash
npm test              # Run tests with coverage
npm run test:watch    # Watch mode for development
npm run test:ci       # CI-optimized test run
```

---

## Performance Best Practices

### 1. **Database Query Optimization**

```typescript
// ✅ Best Practice: Use indexes
// ✅ Best Practice: Limit results
// ✅ Best Practice: Select only needed columns

const users = await db
  .select({ id: users.id, name: users.name, email: users.email })
  .from(users)
  .where(eq(users.companyId, companyId))
  .limit(100);
```

### 2. **API Response Caching**

```typescript
// ✅ Best Practice: Cache expensive queries
const cacheKey = `users:company:${companyId}`;
return cache.memoize(cacheKey, () => storage.getCompanyUsers(), 5 * 60 * 1000);
```

### 3. **Lazy Loading**

```typescript
// ✅ Best Practice: Code splitting
const Analytics = lazy(() => import('./pages/analytics'));
```

---

## DevOps Best Practices

### 1. **Environment Variables**

```bash
# ✅ Best Practice: Required env vars validation
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing env vars: ${missing.join(', ')}`);
}
```

### 2. **Graceful Shutdown**

```typescript
// ✅ Best Practice: Handle shutdown signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
```

### 3. **Health Checks for Deployment**

```bash
# ✅ Best Practice: Health check in deployment
curl http://localhost:5000/ready
# Returns: { status: 'ready', checks: { database: 'ok', ... } }
```

---

## File Structure Best Practices

```
server/
├── __tests__/          # Test files co-located
├── utils/              # Utility functions
│   ├── cache.ts       # Caching utilities
│   └── pagination.ts  # Pagination utilities
├── auth.ts            # Authentication logic
├── errors.ts          # Error classes
├── logger.ts          # Logging configuration
├── validation.ts      # Validation schemas
├── health.ts          # Health check endpoints
└── routes.ts          # API routes

client/src/
├── components/
│   ├── __tests__/     # Component tests
│   ├── ui/            # Reusable UI components
│   └── b2b/           # Business logic components
├── lib/               # Utilities
├── hooks/             # Custom hooks
└── pages/             # Page components
```

---

## Code Quality Standards

### 1. **TypeScript Strict Mode**

```typescript
// ✅ Best Practice: Full type safety
interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'buyer' | 'user';
}

// ❌ Bad: any
function getUser(id: any): any { ... }

// ✅ Good: Proper types
function getUser(id: string): Promise<User | null> { ... }
```

### 2. **Consistent Naming**

```typescript
// ✅ Best Practice: Consistent naming conventions
// - camelCase for variables/functions
// - PascalCase for components/classes
// - UPPER_CASE for constants
// - kebab-case for file names

const userCount = 10;                    // variable
function getUserById(id: string) { }     // function
class UserService { }                    // class
export const MAX_LOGIN_ATTEMPTS = 5;     // constant
```

### 3. **Documentation**

```typescript
/**
 * ✅ Best Practice: JSDoc comments for complex functions
 * Fetches paginated users for a company
 * @param companyId - Company identifier
 * @param options - Pagination options
 * @returns Paginated user list
 */
async function getCompanyUsers(
  companyId: string,
  options: PaginationOptions
): Promise<PaginatedResponse<User>> {
  // ...
}
```

---

## Git Best Practices

### 1. **Conventional Commits**

```bash
# ✅ Best Practice: Conventional commit messages
feat: add user invitation system
fix: resolve authentication token refresh issue
docs: update API documentation
test: add unit tests for validation schemas
refactor: improve error handling middleware
perf: optimize database queries with indexes
```

### 2. **Branch Strategy**

```bash
main                    # Production-ready code
├── develop            # Development integration
    ├── feature/...    # Feature branches
    ├── fix/...        # Bug fix branches
    └── refactor/...   # Refactoring branches
```

---

## Summary

This application implements **industry-standard best practices** across:

- ✅ **Security**: JWT auth, bcrypt, rate limiting, helmet
- ✅ **Validation**: Zod schemas, type safety
- ✅ **Error Handling**: Custom errors, async wrappers
- ✅ **Logging**: Structured Winston logging
- ✅ **Caching**: Smart invalidation, TTL
- ✅ **Testing**: Jest, React Testing Library, 70% coverage
- ✅ **Performance**: Pagination, query optimization
- ✅ **DevOps**: Health checks, graceful shutdown
- ✅ **Code Quality**: TypeScript strict, ESLint, consistent naming

---

*Last Updated: October 2025*
*Following: React, Node.js, and Express.js best practices*
