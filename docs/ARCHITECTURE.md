# KAD ELEVATE Academy 2.0 — Architecture

## Runtime modes

```text
Personal Mode (Vercel/static)
  Browser → bilingual hash-routed UI → IndexedDB/localStorage

Team Mode (persistent Node host)
  Browser → same UI → authenticated JSON API → SQLite/WAL
```

Personal Mode works without an account and keeps progress on the learner's device. Team Mode adds institutional accounts, assignments, evidence review, server-side grading and audit events. Its SQLite database requires a persistent filesystem, so it must run on a persistent Node host rather than an ephemeral serverless function.

## Learning model

The academy contains five tracks and 30 bilingual units. LEAD has ten units; CONNECT, SOLVE, DELIVER and ADAPT have five each. Every unit has a principle, KAD scenario, common mistake, mission and five-question knowledge check. Completion requires reading confirmation, an 80% knowledge score and application evidence.

The original library remains available: 20 videos, 119 questions, nine cases and nine tools. Existing stable IDs are retained so earlier local progress can migrate safely.

## Client and persistence

The client uses native ES modules, CSS and HTML. The build script emits a static `dist/index.html` and copies required assets. Hash routing keeps deep links compatible with static hosting.

IndexedDB `kad_growth_v2` is primary, with a localStorage mirror and explicit JSON import/export. Database schema version 3 adds academy unit progress. Imports are size-limited, type-checked and restricted to known IDs.

## Team security boundary

Team Mode hashes passwords with salted scrypt, stores only hashed session tokens, enforces expiry, CSRF and Origin/Host checks, rate-limits login, and applies strict browser security headers. Role checks protect manager/admin endpoints. Answer keys and grading stay on the server in Team Mode.

The bootstrap command creates the first administrator with a one-time password that must be changed. Runtime data is excluded from Git.

## Deployment boundary

`vercel.json` publishes Personal Mode from `dist/`. Run Team Mode with `npm run team:start` on a Node host with persistent storage and a configured `KAD_ORIGIN`. See `backend/README.md` and `docs/PRODUCTION_DEPLOYMENT.md`.
