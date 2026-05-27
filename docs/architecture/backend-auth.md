# Authentication Architecture

**Location**: `backend/src/auth/` & `backend/src/handlers/auth.ts`

## Edge-Compatible Google OAuth
Cloudflare Workers do not support standard Node.js crypto and HTTP libraries in the exact same way a standard Node server does. Therefore, using the official `google-auth-library` is prone to bundle errors.

## Token Generation
The `instructorToken` (`st_...`) is generated via `crypto.getRandomValues(new Uint8Array(16))`, producing a 32-hex-char suffix (`st_{32 hex}`). When the D1 binding is not configured, a deterministic fallback uses `SHA-256(googleId)` truncated to 32 hex chars, signed with `st_` prefix — this avoids storing state but still provides a consistent per-user token.

## Implementation Details
1. **The JWT Verifier (`src/auth/google.ts`)**:
   - Uses the edge-compatible library `jose` (`jose.jwtVerify`).
   - Dynamically fetches Google's public JWKS (JSON Web Key Set) from `https://www.googleapis.com/oauth2/v3/certs`.
   - Validates the token's signature, issuer (`accounts.google.com`), and audience (our `GOOGLE_CLIENT_ID`).

2. **The Flow (`src/handlers/auth.ts`)**:
   - The Preact frontend utilizes Google Identity Services to spawn a popup and retrieve an ID Token.
   - The frontend POSTs this ID Token to `/api/auth/google`.
   - The backend verifies the token and extracts the `sub` (Google ID), `email`, and `name`.
   - The backend performs an `upsert` in the `instructors` collection.
   - The backend responds with our internal `instructorToken`.
   - All subsequent protected API calls use this internal token via the `Authorization: Bearer <token>` header, drastically reducing the latency of re-verifying the Google JWT on every request.

## Cross-Tenant Isolation
The `instructorToken` is the sole ownership key. Plans and sessions are scoped by it in every query filter. A 404/403 is returned for cross-tenant access attempts.
