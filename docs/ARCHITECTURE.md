# Architecture · Open Edition
Release: 1.0.0 · 2026-09-16

## Current executable architecture

```text
Browser
  ├─ hash router + accessible bilingual views
  ├─ curriculum / original assessments / workplace cases
  ├─ formative learning engine
  ├─ versioned local state
  │    ├─ localStorage
  │    └─ explicit JSON export / replacement import
  └─ consent-triggered official YouTube IFrame Player
```

No server API, hosted database, authentication SDK, external analytics SDK, or AI model is required.
The application is a browser application built with native ES modules, CSS, and HTML, not Next.js or React.
This keeps the delivered open version runnable without downloading dependencies.
The content layer is separate from rendering and exports to JSON for a later framework migration.

## Language journeys

The first run shows a language gate (`#/welcome`). The UI language selects
exactly one journey: Arabic lessons, quizzes, and descriptions only, or
English only. Lessons carry stable IDs plus canonical identities
(`leadership.<moduleId>.<lessonId>`); progress is preserved per journey and
changing language never deletes it. Direct links across languages render an
explanatory notice instead of substituted content.

## Storage

IndexedDB `kad_growth_v2` is primary; the original `localStorage` key stays
as a synchronous write-through mirror. Schema v2 migrates v1 backups
in memory (manual viewing credit ends; all other evidence preserved with an
audit entry). Persistence is requested where supported; Settings shows
storage health. See `DATA_PERSISTENCE.md` and `MIGRATION_V1_V2.md`.

## Video providers

Preview mode uses the official YouTube IFrame Player after explicit consent
(`STRICT_KAD_VIDEO_MODE = false`). Provider-native branding is accepted, not
masked. Strict mode (KAD-controlled streaming) is architecturally reserved
behind the flag. See `VIDEO_POLICY.md`.

## Build contract

`scripts/build.mjs` collects a fixed ordered set of native modules, removes their named module wrappers,
inlines CSS and the supplied PNG, and emits one `dist/index.html`.
The bundler is intentionally small and tailored to the current simple named imports.
When adding dynamic imports, third-party packages, or more complex module syntax, replace it with a maintained bundler;
do not assume it is a general-purpose JavaScript parser.

No font files or video files are bundled. The site uses installed system fonts.
The original logo bytes remain unchanged. CSS bounds the display viewport around the mark without redrawing it.

## Routing

Hash routes (`#/leadership`, `#/learn/what-is-leadership`) allow simple static hosting with no server rewrite.
Unknown public tracks are not navigable as active courses. Future course metadata is confined to authoring previews.
Hiding a client route is not an authorization boundary: this distribution contains no private corporate data.

## Learning records

State schema version: 1. Storage key: `kad-growth.open.v1`.

| State section | Meaning |
|---|---|
| profile | Optional local name, department, role, weekly intention |
| progress | Unique played seconds, actual player duration, self-confirmation, quiz attempts, reflection |
| quizDrafts | Shuffled question/option order and selected stable option IDs |
| notes / saved | Local personal notes and bookmarked lesson IDs |
| assessments | Separate pre/post self-reflection ratings |
| practices | Draft/submitted fields and self-review checklist |
| toolValues | Editable original tools |
| capstone | Draft/submitted final application record |
| contentOverrides | Local replacement video IDs and review notes |
| issues | Local issue reports, not messages sent to a help desk |

A denied or full storage engine does not crash the UI; it shows a persistence warning.
A corrupt stored record is not silently erased. Export, reset, and restore are explicit user actions.
Imports are size-limited, type-checked, prototype-key rejected, and filtered against known content IDs.
Imported records remain user-controlled evidence, never verified institutional records.

## Knowledge checks

Every lesson has its own actual question set, not generated filler.
The bank totals 119 questions. Retakes reshuffle those existing questions and answers;
they do not claim to draw fresh items from a larger unimplemented pool.
A question has bilingual prompt, four bilingual options, a stable correct option ID, and bilingual explanation.
Answer order is randomized in the interface. Passing threshold is 80%.

Questions and correct answers are shipped in the client, so this is appropriate for formative learning,
not controlled exams, payroll decisions, performance ranking, or professional certification.
Before high-stakes use, move grading and answer keys to an authenticated server.

## Video integration

API: https://developers.google.com/youtube/iframe_api_reference

The official API is loaded only after a user requests the player. The embed uses the privacy-enhanced host.
The browser's actual origin is passed to the player; referrers are not spoofed.
Network and embedding errors preserve an external official-source link, course notes, quiz, and
a clearly labeled self-confirmation path.

Watch progress stores distinct observed seconds. Seeking over content does not credit the skipped span.
Playback tracking is a learning convenience, not proof of attention or identity.
Exact duration is read at runtime from the player and is not fabricated in the content registry.
A `file://` preview cannot provide the same web-origin context, so it uses the external link alternative.

## Extension boundary

Preserve curriculum IDs when migrating frameworks or databases.
Introduce a storage adapter and authenticated API before enabling the dormant account forms.
See `backend/README.md` for the proposed server contract and acceptance gates.
Enabling a form or hiding the admin link is not sufficient to add secure access control.
