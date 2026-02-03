# Next.js App Router Migration Plan

## Overview
The codebase is already using Next.js 16, but the error handling and logging middleware files contain Express-specific code that needs to be updated for Next.js 14+ App Router patterns (route handlers and Server Actions).

## Current State Analysis

### ✅ Already Compatible
- **Project Structure**: Already Next.js with App Router (`src/app/`)
- **Dependencies**: Next.js 16.0.7 is installed
- **Core Modules**: All business logic in `src/lib/` is framework-agnostic
- **Storage, Validation, Errors**: Core utilities work with any framework

### ❌ Needs Updates
1. **Error Middleware** (`src/lib/errors/middleware.ts`):
   - Uses Express types (`Request`, `Response`, `NextFunction`)
   - Has `handleApiError` and `withErrorHandling` but they use old Next.js Pages Router patterns (`NextApiRequest`, `NextApiResponse`)
   - Needs App Router route handler support (`NextRequest`, `NextResponse`)

2. **Logging Middleware** (`src/lib/logging/middleware.ts`):
   - Uses Express types and patterns
   - `withLogging` wrapper uses generic types but needs App Router support
   - Context extraction works but could be enhanced for Next.js

3. **Context Extraction** (`src/lib/logging/context.ts`):
   - Works with generic request objects but could be optimized for `NextRequest`
   - IP extraction logic should use Next.js headers

4. **Documentation**: README files reference Express examples that need updating

5. **Type Dependencies**: `@types/express` is in devDependencies but not needed for App Router

## Migration Plan

### Phase 1: Update Error Handling Middleware

**File**: `src/lib/errors/middleware.ts`

**Changes Needed**:
1. **Add Next.js App Router route handler utilities**:
   - Create `handleRouteError(error, request: NextRequest)` function
   - Returns `NextResponse` with proper error formatting
   - Extracts request context from `NextRequest`

2. **Update `handleApiError`**:
   - Keep for backward compatibility but mark as deprecated
   - Add new `handleRouteError` that uses `NextRequest`/`NextResponse`

3. **Create route handler wrapper**:
   - `withRouteErrorHandling(handler)` that wraps App Router route handlers
   - Automatically catches errors and returns `NextResponse`
   - Type signature: `(req: NextRequest, context: RouteContext) => Promise<NextResponse>`

4. **Keep Express utilities** (for potential future use or external services):
   - Keep `errorHandler` and Express `asyncHandler` but mark as legacy
   - Add JSDoc comments indicating they're for Express compatibility only

**New Functions to Add**:
```typescript
// For App Router route handlers
export function handleRouteError(
  error: unknown,
  request: NextRequest
): NextResponse

export function withRouteErrorHandling(
  handler: (req: NextRequest, context?: RouteContext) => Promise<NextResponse>
): (req: NextRequest, context?: RouteContext) => Promise<NextResponse>
```

### Phase 2: Update Logging Middleware

**File**: `src/lib/logging/middleware.ts`

**Changes Needed**:
1. **Add Next.js App Router route handler logging**:
   - Create `withRouteLogging` wrapper for route handlers
   - Extracts context from `NextRequest`
   - Logs request/response with timing

2. **Update `withLogging`**:
   - Keep for backward compatibility
   - Add new `withRouteLogging` specifically for App Router

3. **Create route handler wrapper**:
   - Wraps `(req: NextRequest, context?: RouteContext) => Promise<NextResponse>`
   - Automatically logs requests/responses
   - Integrates with error handling

**New Functions to Add**:
```typescript
// For App Router route handlers
export function withRouteLogging(
  handler: (req: NextRequest, context?: RouteContext) => Promise<NextResponse>,
  logger?: Logger
): (req: NextRequest, context?: RouteContext) => Promise<NextResponse>
```

### Phase 3: Enhance Context Extraction

**File**: `src/lib/logging/context.ts`

**Changes Needed**:
1. **Add Next.js-specific context extraction**:
   - Create `extractNextRequestContext(request: NextRequest)` function
   - Uses `request.headers`, `request.ip`, `request.url`
   - Extracts user from cookies/headers if available

2. **Update `extractRequestContext`**:
   - Keep generic version for backward compatibility
   - Add optimized Next.js version

3. **Add NextRequest support to `createRequestLogger`**:
   - Overload function to accept `NextRequest`
   - Automatically uses Next.js context extraction

**New Functions to Add**:
```typescript
export function extractNextRequestContext(
  request: NextRequest
): RequestContext

export function createRequestLoggerFromNextRequest(
  logger: Logger,
  request: NextRequest
): Logger
```

### Phase 4: Create Next.js Middleware File

**New File**: `src/middleware.ts` (Next.js middleware)

**Purpose**: Global middleware for authentication, logging, CORS

**Structure**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getLogger, createRequestLoggerFromNextRequest } from "@/lib/logging";

export function middleware(request: NextRequest) {
  // Request logging
  // Authentication checks
  // CORS headers
  // Rate limiting (if needed)
}
```

### Phase 5: Update Documentation

**Files to Update**:
1. `src/lib/errors/README.md`:
   - Add App Router route handler examples
   - Update examples to use `NextRequest`/`NextResponse`
   - Mark Express examples as legacy

2. `src/lib/logging/README.md`:
   - Add App Router route handler examples
   - Update context extraction examples
   - Add Next.js middleware examples

3. `src/lib/errors/middleware.ts`:
   - Update JSDoc comments with App Router examples
   - Mark Express functions as legacy

4. `src/lib/logging/middleware.ts`:
   - Update JSDoc comments with App Router examples
   - Mark Express functions as legacy

### Phase 6: Update Package Dependencies

**File**: `package.json`

**Changes**:
1. **Remove** (optional, can keep for type checking):
   - `@types/express` - Not needed for App Router

2. **Verify** (should already be present):
   - `next` - ✅ Already installed (16.0.7)
   - `@types/node` - ✅ Already installed

### Phase 7: Create Example Route Handlers

**New Files** (for reference/documentation):
1. `src/app/api/example/route.ts` - Example route handler with error handling and logging
2. `src/actions/example.ts` - Example Server Action with error handling

**Purpose**: Show developers how to use the updated utilities

## Implementation Order

1. **Phase 3** (Context Extraction) - Foundation for other changes
2. **Phase 1** (Error Handling) - Core functionality
3. **Phase 2** (Logging) - Depends on context extraction
4. **Phase 4** (Middleware) - Uses logging and error handling
5. **Phase 5** (Documentation) - Documents all changes
6. **Phase 6** (Dependencies) - Cleanup
7. **Phase 7** (Examples) - Reference implementation

## Backward Compatibility Strategy

- **Keep Express utilities**: Don't remove Express functions, mark as legacy
- **Add new App Router utilities**: Create new functions alongside old ones
- **Gradual migration**: Teams can migrate route by route
- **Type safety**: Use TypeScript to ensure correct usage

## Testing Strategy

1. **Unit Tests**: Test new Next.js utilities in isolation
2. **Integration Tests**: Test route handlers with error handling and logging
3. **Example Route Handlers**: Create test routes to verify functionality
4. **Backward Compatibility**: Ensure existing code still works

## Files Summary

### Files to Modify
- `src/lib/errors/middleware.ts` - Add App Router utilities
- `src/lib/logging/middleware.ts` - Add App Router utilities  
- `src/lib/logging/context.ts` - Add NextRequest support
- `src/lib/errors/README.md` - Update documentation
- `src/lib/logging/README.md` - Update documentation
- `package.json` - Remove `@types/express` (optional)

### Files to Create
- `src/middleware.ts` - Next.js global middleware
- `src/app/api/example/route.ts` - Example route handler (optional)
- `src/actions/example.ts` - Example Server Action (optional)

### Files to Keep As-Is
- All core business logic in `src/lib/` (storage, validation, etc.)
- Database schema and Prisma setup
- All test scripts

## Key Design Decisions

1. **Dual Support**: Keep Express utilities for backward compatibility
2. **Type Safety**: Use TypeScript overloads for different request types
3. **Consistent API**: New App Router utilities follow same patterns as Express ones
4. **Performance**: Optimize for Next.js request/response cycle
5. **Developer Experience**: Clear examples and documentation

## Estimated Impact

- **Breaking Changes**: None (backward compatible)
- **New Features**: App Router route handler support
- **Migration Effort**: Low (additive changes)
- **Testing Required**: Medium (new utilities need tests)

