# CORS allowlists need explicit deploy config

When frontend and backend are deployed separately, permissive CORS often survives because local development works fine with same-origin assumptions hidden by tooling.

For this codebase, backend CORS must stay driven by an explicit `FRONTEND_ORIGINS` allowlist instead of `*` so authenticated bearer-token endpoints do not become readable from arbitrary origins.

This is operational knowledge, not just a code detail: any new frontend hostname must be added to deploy config before expecting browser access to work.
