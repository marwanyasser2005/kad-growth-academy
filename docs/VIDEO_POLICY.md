# Video policy · سياسة الفيديو

## Two modes

**Preview mode (`STRICT_KAD_VIDEO_MODE = false`, current).** Lessons use the
official YouTube IFrame Player, loaded only after the learner's explicit
choice. The consent screen names the provider honestly. Provider-native
YouTube branding inside the player is accepted as-is: `modestbranding` is
deprecated and the video title/uploader identity can appear before, during,
or after playback. No overlay, parameter, or CSS is used to mask it.

**Strict KAD video mode (`STRICT_KAD_VIDEO_MODE = true`, future).** Only
KAD Originals, KAD-owned, or explicitly licensed videos may publish, streamed
through a KAD-controlled adaptive player (Mux / Cloudflare Stream or
equivalent). Third-party videos are never downloaded or re-uploaded without
explicit rights.

## Learner UI vs admin provenance

- Learner cards, headings, and toolbars carry no source/channel labels.
- Full provenance (owner, channel, URL, verification, rights, versions) lives
  in the admin content register and the exported source register only.
- Quiz banks, notes, and explanations are platform-authored and monolingual
  per UI language. They are never presented as provider assessments.

## Publishing gates for any video ID

URL exists · title matches · spoken language matches the lesson language ·
embedding allowed · duration known · full-content relevance watched ·
quiz aligned · institutional reuse reviewed. New candidate IDs ship as
`draft` and are excluded from learner routes until every gate passes.
Automated embed checks plus manual review are required before production.
