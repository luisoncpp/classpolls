```sh
cd backend && npm run deploy       # Deploy backend
cd frontend && npm run build && npx wrangler pages deploy dist --project-name classpolls --branch main  # Build + deploy frontend
```