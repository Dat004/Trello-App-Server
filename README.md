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

## Security

Do not commit `.env`. Production cookies require HTTPS, and `CLIENT_URL` must exactly match the deployed frontend origin. A previously populated Cloudinary secret was removed from `.env.example`; rotate that credential before deployment because repository history or local copies may still expose it.