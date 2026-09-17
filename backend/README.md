# KAD ELEVATE Team Mode

Team Mode is a real Node.js and SQLite service for controlled pilots. It is separate from the local-first Personal Mode.

## What is implemented

- Accounts created by an administrator; no public self-registration.
- Scrypt password hashing with random salts and forced first-login password change.
- Opaque server sessions stored as SHA-256 hashes; HttpOnly, SameSite=Strict cookies.
- Eight-hour absolute sessions and 30-minute idle expiry.
- Origin checks, CSRF tokens, request-size limits, login rate limits, CSP and clickjacking protection.
- Learner, manager and admin roles enforced on the server.
- Server-side quiz grading; answer keys are absent from `/api/catalog`.
- Unit progress, assignments, deliberately shared evidence, manager review and immutable audit events.
- Managers see only explicitly assigned learners and deliberately shared evidence. Personal notes are not in the team schema.
- WAL-mode SQLite with foreign keys, transactions and recovery-friendly single-file storage.

## Start a controlled pilot

Requires Node.js 22.16 or newer because it uses the built-in `node:sqlite` module.

```bash
npm run build
npm run team:bootstrap -- --email admin@company.example --name "KAD Administrator"
npm run team
```

Open `http://127.0.0.1:3000/#/login`, sign in with the temporary password printed once by bootstrap, and change it immediately.

Environment variables: `PORT` or `KAD_TEAM_PORT`, `KAD_TEAM_HOST`, `KAD_DATA_DIR`, and `KAD_COOKIE_SECURE=true` behind production HTTPS.

The `backend/data` directory is ignored by Git. Back it up outside the server using encrypted storage and test restoration before employee use.

## Deployment boundary

The included Vercel configuration publishes Personal Mode only. SQLite Team Mode requires a persistent disk and a single coordinated Node service; do not deploy its database on ephemeral serverless storage. Place the Node service behind an HTTPS reverse proxy, restrict host access, set `KAD_COOKIE_SECURE=true`, monitor logs, and adopt retention and deletion rules before real employee records are added.

This implementation is suitable for a controlled pilot after organizational, security and content approval. It is not an accreditation system, an automated promotion engine, SSO, MFA, HRIS, SCORM/xAPI, or a penetration-test claim.
