# MongoDB + Cloudflare Workers: Local Dev Latency

## Problem

Running `wrangler dev` (Miniflare) with the official `mongodb` driver produces 2-6s latency per request even against a tiny Atlas M0 database. Deploying the same worker to Cloudflare drops latency to ~0.8-1s.

## Root Cause

Miniflare's simulated Workers environment (particularly on Windows) does not handle the MongoDB driver's TLS + SRV DNS resolution as efficiently as the real Cloudflare Workers runtime. The driver's connection-keepalive and socket-reuse patterns also behave differently in the Miniflare sandbox.

## What Worked

- **Use `wrangler dev --remote`** instead of local Miniflare when testing against real MongoDB. The remote worker runs on Cloudflare's network and has realistic network performance.
- **Use non-SRV connection strings** (`mongodb://` instead of `mongodb+srv://`) for local dev on Windows. Miniflare has issues with SRV DNS resolution that can cause hangs or timeouts.
- **Accept the latency for local dev**. If you must use `wrangler dev` (local), treat the 2-6s per request as a known environmental limitation, not a code problem.

## What Didn't Help

- Removing the MongoClient cache to create fresh connections per request (actually made latency worse since each request pays TLS handshake).
- Adding MongoDB indexes (the database had ~10 documents; the bottleneck was never query scanning).
- Per-request index initialization (added overhead without benefit).

## Config Management

- **Do NOT put secrets in `wrangler.toml`**. Even with a warning comment, they can be exposed on `wrangler deploy`.
- Use `backend/.dev.vars` for local development (Wrangler auto-loads it, and it's git-ignored).
- Use `wrangler secret put <NAME>` for production secrets.
- The `vars` section in `wrangler.toml` should only contain non-sensitive configuration.
