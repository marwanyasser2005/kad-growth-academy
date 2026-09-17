# Content operations and editorial handoff

## Open release content

The Leadership track is published in the open prototype.
Its resources have a public title/URL match record, not a guarantee of playback, reuse rights, captions, or transcript coverage.
Every lesson includes original bilingual platform notes and an original topic-aligned knowledge check.

## Files to edit

| File | Responsible content |
|---|---|
| src/data/curriculum.mjs | Module order, objectives, original brief, YouTube ID, source metadata |
| src/data/questions.mjs | Bilingual prompt/options/explanation and stable answer ID |
| src/data/practice.mjs | Workplace cases, templates, future authoring blueprints |

After changing data, run `npm run check`, `npm test`, `npm run export`, and `npm run build`.
Editing `content/*.json` alone does not change the running site; those files are exported handoff snapshots.
The local CMS preview can replace a YouTube ID on one device. It does not publish a new build or re-author the quiz.

## Source review

For each resource, a human content reviewer should:
1. Open the actual source on the intended corporate network.
2. Confirm the official uploader and record the original title.
3. Watch the full selection, record exact duration and actual caption languages.
4. Check educational relevance, terminology, and misleading generalizations.
5. Confirm permitted institutional use under the source's applicable terms; do not equate public viewing with open licensing.
6. Confirm embedded playback or deliberately select external-link-only delivery.
7. Compare every assessment item with the authored brief and any source-specific claim.
8. Add the reviewer, review date, evidence location, content version, and next review date.

Do not download and rehost source videos or publish transcript copies without permission.
No TED resource is included in the active curriculum.
No provider logo, endorsement, accreditation, or certificate has been imported.

## Question-size rule

Current counts are **editorial complexity choices**, not claimed calculations from unverified video durations:
5 for foundation coverage, 7 for applied multi-concept lessons, and 10 for the extended integration lesson.

After duration and transcript review, use 5–10 questions per complete selection.
For a very long source, either curate a documented complete segment with its own objectives or divide it into lessons;
do not claim chapters that have not actually been authored and timed.

Each item must have one defensible best answer under its stated conditions.
Avoid diagnosing personalities, ranking employees, or presenting a theory as universal fact.
Scenario answers must not bypass technical approval, safety responsibility, or the company's project authority.
The current content explicitly distinguishes leadership influence from permission to approve engineering decisions.

## Future tracks

Eleven blueprints exist under `#/admin/roadmap`. Each contains an authoring structure and publication gates,
but not a pretend completed set of future videos.

To publish a future track, add a real curriculum with stable IDs, validated bilingual resources,
actual question sets, cases/tools, rights review, and functional tests. Then extend the runtime
track selector and route/filter logic. Flipping `visible` alone does not build the missing course.

## Maintenance policy

A practical internal review cadence is every 90 days and whenever a source changes.
This is a proposed operating policy, not an already scheduled automation.
A title change, ID replacement, or unavailable resource should open an editorial review;
preserve prior learning records with the prior lesson version rather than silently reinterpreting them.

## Automation supplied

`npm run verify:sources` can check public YouTube oEmbed metadata from a normal network.
It does not download videos, collect transcripts, or authenticate to YouTube.
A successful oEmbed response confirms metadata resolution only; it cannot certify playback, permissions,
caption accuracy, or assessment alignment. Manual review remains required.
