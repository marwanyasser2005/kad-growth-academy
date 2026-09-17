# Quality assurance report
Release 2.0.0 · 2026-09-17

## Release 2.0 acceptance

- Content integrity: 5 active tracks, 30 original bilingual units and 150 formative questions.
- Preserved library: 9 legacy modules, 20 videos, 119 questions, 9 cases and 9 tools.
- Automated tests: 41/41 passed, including unit completion and Team Mode password/session helpers.
- Production build: PASS; self-contained Personal Mode HTML plus manifest, service worker and logo asset.
- Browser verification: Arabic RTL home, a full unit completion flow, responsive 390 × 844 layout, and no horizontal overflow in the checked mobile route.
- Team API smoke: health PASS, 5 tracks/30 units returned, public catalog contains no answer keys, administrator login/session/CSRF PASS.

The release keeps the earlier QA history below as provenance for the preserved library.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Content integrity | PASS: 9 modules, 20 lessons, 119 questions, 9 cases, 9 tools, 11 hidden blueprints | `npm run check` |
| Node unit tests | 26 passed / 26 | `evidence/unit-tests.tap` |
| Chromium DOM/browser workflow assertions | 326 passed / 326 | `evidence/browser-report.json` |
| Route/viewport matrix | 71 routes in Arabic/English × desktop/mobile, 4 variants | same report |
| Uncaught page errors in recorded run | 0 | `page_errors` |
| Horizontal overflow in recorded matrix | 0 | `overflow` |
| Production build | PASS; self-contained HTML generated | `dist/index.html` |
| Optional metadata verifier syntax | PASS: `node --check` | not a network audit |

The 71-route matrix includes the home/learning/account/admin screens, each lesson and practice/tool page,
future authoring blueprints, and representative rejected/unknown public routes.
It is not a claim that 71 separate backend endpoints exist.

## Browser environment and important limitation

Browser execution used Chromium and Playwright `page.set_content` to render the generated artifact.
The build environment disallowed ordinary URL navigation. No attempt was made to bypass that policy.
A **test-only in-memory localStorage implementation** was used for DOM workflow tests.
It is not part of the delivered app.

Therefore:
- UI transitions, local-state serialization, import/export, scoring, validation, rendering, and visible flows were exercised.
- Native browser storage behavior across a real origin reload still needs a deployment smoke test.
- Real external YouTube playback, player restrictions, network latency, and captions were **not verified** here.
- The separately executed local server responded to a local HTTP root request, but that is not a full hosted end-to-end test.

## Behavioral coverage

The suite exercises Arabic default/English switching; all 20 library entries and 11 Arabic entries;
empty search; incomplete quiz rejection; actual scoring and answer explanations; retakes;
lesson requirements; immediate reflection persistence; bookmarks; escaped note input;
practice validation and self-review; editable tools; nine baseline ratings; optional profiles;
capstone validation; gated completion records; admin metadata validation; locally saved issue reports;
inactive account forms; backup download/import validation; and reset confirmation.

Unit tests cover correct option integrity, bilingual data, hidden tracks, source caveats, scoring boundaries,
shuffle stability, distinct watch coverage, strict 90% coverage without rounding upward,
completion rules, actual-zero progress, import schema rejection, HTML escaping,
and denied/corrupted/full storage handling.

## Visual evidence

Actual application screenshots, not generated promotional mockups:

- `evidence/home-desktop-ar.png`
- `evidence/home-desktop-en.png`
- `evidence/home-mobile-ar.png`
- `evidence/home-mobile-en.png`
- `evidence/lesson-desktop-en.png`
- `evidence/lesson-mobile-ar.png`
- `evidence/admin-desktop-en.png`

## Change record v2 (language journeys, IndexedDB, quiz gating)

Executed 2026-09-17 in this environment: `node scripts/check.mjs` PASS
(9 modules, 20 lessons, 119 questions, 9 scenarios, 9 tools, 11 hidden
blueprints, strict mode off, 20 draft video candidates); `node --test`
35 passed / 35 (26 updated + 9 new: gating, canonical IDs, merge,
checksum, v1 migration, language scoping, strict-mode guard);
`npm run build` PASS (self-contained `dist/index.html` plus manifest and
service worker). Python files compile (`py_compile`).

Not executed here: the Playwright browser matrix (no Chromium in this
environment). `tests/browser_smoke.py` was updated for the language gate,
language-scoped library, quiz lock, and merge/replace import, and must run
in CI before any institutional rollout claim. New video-candidate IDs are
drafts only: no URL, language, duration, embedding, or reuse verification
is claimed. No backend, SSO, or cross-device sync was added.

## Not claimed or not executed

No public hosting deployment, authenticated backend, Supabase migration, cross-device sync,
real manager workflow, source-owner licensing approval, penetration test, external accessibility certification,
load test, real-device Safari/Firefox matrix, or measured workplace learning outcome was completed.

The metadata verification script is delivered for subsequent use from a normal network.
Its syntax was checked; no all-sources-live result is claimed.

## Launch acceptance still required

Run on the intended domain and corporate network; verify live videos and fallback links, real refresh persistence,
backup/restore, both languages on actual mobile devices, content-source permissions, and complete quiz-to-content review.
Do not enable dormant credential forms until a real authenticated server and tested authorization exist.
