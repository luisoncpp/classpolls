# ClassPolls

Real-time classroom polling app. Instructors create question plans, open live sessions with a 4-character room code, and students join instantly — no accounts needed.

## How It Works

1. **Instructor** signs in with Google, builds a question plan, and opens a classroom session.
2. **Students** join via room code and vote on questions as they go live.
3. **Live stats** show real-time vote distributions. Results reveal after countdown expiry.
4. An **overlay view** is provided for OBS/projectors — clean, read-only, no chrome.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Preact, TypeScript, Vite |
| Backend | Cloudflare Workers, TypeScript |
| Database | MongoDB Atlas |
| Auth | Google Identity Services + JWT verification (`jose`) |
| Testing | Vitest (jsdom + Cloudflare Workers pool) |

## Project Structure

```
frontend/     Preact SPA — student, instructor, and overlay views
backend/      Cloudflare Worker — REST API and MongoDB integration
docs/         Architecture, flows, specs, and design documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster
- A Google Cloud project with OAuth 2.0 credentials

### Backend

```bash
cd backend
npm install
npm run dev        # Starts Wrangler on http://127.0.0.1:8787
```

Set secrets via `.dev.vars`:

```
GOOGLE_CLIENT_ID=your-client-id
MONGODB_URI=your-connection-string
MONGODB_DATABASE=your-db-name
JWT_SECRET=your-signing-secret
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Starts Vite on http://localhost:5173 (proxies /api to backend)
```

### Type Checking & Tests

```bash
# Backend
cd backend && npm run typecheck && npm test

# Frontend
cd frontend && npm run typecheck && npm test
```

## Key API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/google` | Exchange Google ID token for instructor token |
| `GET`/`POST`/`DELETE` | `/api/plans` | CRUD for question plans |
| `POST` | `/api/sessions` | Create a live session from a plan |
| `GET` | `/api/sessions/:roomCode` | Public session poll (student/overlay) |
| `GET` | `/api/sessions/:roomCode/stats` | Instructor stats with vote data |
| `POST` | `/api/sessions/:roomCode/vote` | Submit a student vote |

## License

CC BY-NC 4.0
