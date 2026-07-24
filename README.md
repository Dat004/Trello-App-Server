# Trello Portfolio API

Express, MongoDB, and Socket.IO backend for the sibling React client.

## Capabilities

- Cookie-based JWT authentication and Google sign-in
- Workspace, board, list, card, comment, attachment, template, and notification APIs
- Resource-aware permission policies and nested route context validation
- Realtime collaboration events and scheduled due-date reminders
- Cloudinary uploads, SMTP notifications, search, favorites, and optional Gemini templates
- Helmet, credentialed CORS, request-origin checks, and centralized error handling

## Setup

Requires Node.js 22+, npm, and MongoDB.

```bash
npm ci
copy .env.example .env
npm run dev
```

Configure `MONGO_URI`, a strong `JWT_SECRET`, `CLIENT_URL`, Google OAuth, Cloudinary, SMTP, and optional Gemini values in `.env`. The example file contains placeholders only.

## Scripts

- `npm run dev` — run the API with Nodemon
- `npm start` — run the API with Node.js
- `npm test` — run the built-in Node.js test suite
- `npm run seed:templates` — reset system board templates
- `npm run seed:demo` — upsert owner/admin/member/viewer demo accounts and a sample board
- `npm run seed:large-board` — recreate a large board for FE perf measurement (default 6×50 cards; override with `LARGE_BOARD_*` env vars)

## Security

Do not commit `.env`. Production cookies require HTTPS, and `CLIENT_URL` must exactly match the deployed frontend origin. A previously populated Cloudinary secret was removed from `.env.example`; rotate that credential before deployment because repository history or local copies may still expose it.

## Render free-tier cold start (demo for recruiters)

Free web services **sleep after ~15 minutes** idle. Recruiters open your CV link at random times, so **you cannot warm the API manually** — something else must ping it every few minutes, 24/7.

### Do this once (recommended): UptimeRobot

1. Create a free account at [UptimeRobot](https://uptimerobot.com/).
2. **Add New Monitor** → type **HTTP(s)**.
3. URL: `https://YOUR-SERVICE.onrender.com/api/health`
4. Interval: **5 minutes**.
5. Save. Leave it running for the whole hiring season.

This keeps the dyno awake even when nobody has opened your site.

### Backup: GitHub Action in this repo

`.github/workflows/keep-awake.yml` also pings every 10 minutes, but GitHub free cron can delay 5–20+ minutes — less reliable alone than UptimeRobot.

- Secret `RENDER_HEALTH_URL` = `https://YOUR-SERVICE.onrender.com/api/health`
- Actions → **Keep Render Awake** → Run workflow once to verify.

### Extra (already in FE)

SPA warms `/api/health` on load and retries one failed API call after wake — helps if sleep still happens, but **does not replace** an external ping.

### Best reliability for interview season

Upgrade Render to **Starter** (no sleep) until you have offers / stop sharing the demo.