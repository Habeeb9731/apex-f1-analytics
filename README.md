# APEX — F1 Analytics

Local historical Formula 1 analytics dashboard. The UI reads public historical session data from OpenF1 (2023 onward); no account, paid API, live timing, or server is required.

## Run locally

```sh
cd f1-analytics
npm install
npm run dev
```

Vite serves the app at `http://127.0.0.1:5173`. `npm run build` creates a local static bundle in `dist/`.

## Data behavior

- Season selection loads meetings and sessions by their API year and meeting keys.
- Historical requests are cached in TanStack Query and cancelled when abandoned.
- Telemetry loads two chosen drivers for a five-minute window at a time, filters at the API, then downsamples chart points.
- Championship standings use OpenF1's available snapshots. Missing snapshots remain empty.
- Track traces are reconstructed from approximate OpenF1 location coordinates; they are not surveyed circuit geometry.
- Weather and race-control views display source observations only.
- Favorites are stored in this browser's local storage. Season, race, and session selections are reflected in URL query parameters.

OpenF1 historical-data documentation: https://openf1.org/docs/

## Optional AI race analyst

The dashboard remains public. Only opening **Ask Apex** asks the visitor to sign in with GitHub. The chatbot calls the OpenAI API from the local Node server, so the OpenAI key is never shipped to the browser. Chat use is limited to 10 questions per GitHub account per UTC day; GitHub IDs in `GITHUB_ADMIN_IDS` receive the configured admin limit. Counts are stored in SQLite under `data/`. Production OAuth fails closed unless `GITHUB_ALLOWED_IDS` contains the invited users' numeric GitHub IDs; local development permits any GitHub account while that list is empty.

### Configure local OAuth and AI

1. In GitHub, create an OAuth App with homepage URL `http://127.0.0.1:5173` and callback URL `http://127.0.0.1:5173/api/auth/github/callback`.
2. Copy `.env.example` to `.env` and add the GitHub client ID and secret, an OpenAI API key, and a random `SESSION_SECRET` of at least 32 characters. Keep `.env` private.
3. For local testing, you can sign in with any GitHub account. Before deployment, put the numeric IDs for invited users in `GITHUB_ALLOWED_IDS`; add your own ID to `GITHUB_ADMIN_IDS` to receive the larger quota. The GitHub ID is the `id` field returned by `https://api.github.com/users/YOUR_GITHUB_USERNAME`.
4. Run `npm run dev`. The dashboard is available at `http://127.0.0.1:5173`; OAuth and chat are served by the local Node backend.

Without OAuth credentials, the public dashboard still works and Ask Apex explains that sign-in is not configured. Without an OpenAI key, GitHub sign-in works but chat answers remain disabled.

### Deployment notes

Before deploying, use HTTPS and set `APP_ORIGIN` to the final public origin, update the GitHub OAuth callback URL to `${APP_ORIGIN}/api/auth/github/callback`, set `NODE_ENV=production`, provide a persistent `SQLITE_PATH`, and keep all keys in the server environment. The current rate limits are per GitHub user plus a small in-process burst limit; run one server instance unless burst limiting is moved to shared storage.
