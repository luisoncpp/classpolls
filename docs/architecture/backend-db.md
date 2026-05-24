# Database Deep Module Architecture

**Location**: `backend/src/db/`

## Philosophy
The backend connects to MongoDB Atlas using the official `mongodb` driver directly from Cloudflare Workers. The Worker runtime enables `nodejs_compat`, and the private DB layer owns the connection lifecycle so route handlers stay free of driver details.

## The Deep Module Rule

1. **Private Layer (`src/db/Private/client.ts`)**
   - Creates and caches the `MongoClient` in module scope.
   - Returns a `Db` instance from the configured `MONGODB_URI` and database name.
   - Is never imported by handlers.

2. **Public Layer (`src/db/index.ts`)**
   - Exposes domain operations like `listPlans`, `upsertInstructor`, and `createSession`.
   - Keeps the public API small and business-focused.
   - Hides `ObjectId`, collection names, and Mongo update syntax from handlers.

## Testing
Unit tests mock `src/db/index.ts` directly. They validate handler behavior against the public DB contract rather than asserting driver calls.
