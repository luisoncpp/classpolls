# Architecture Docs

Canonical technical guides — the single source of truth for each subsystem's design, data model, and behavior rules.

| File | Subsystem | Notes |
|------|-----------|-------|
| `backend-db.md` | Database Deep Module | Rules and structure for Cloudflare D1 interactions in Workers. |
| `backend-auth.md` | Authentication Flow | Google ID Token validation, token generation, cross-tenant isolation. |
| `backend-sessions.md` | Session Lifecycle | Create → activate → deactivate → close, student vs instructor projections, vote registration. |
| `frontend-polling.md` | Frontend Polling & Identity | SessionPollingController, VoteDispatcher, apiClient, identity bootstrap. |
