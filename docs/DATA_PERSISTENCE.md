# Data persistence · ثبات البيانات

## Where progress lives (open edition)

Primary store: **IndexedDB** database `kad_growth_v2` (object stores:
profile, preferences, lessonProgress, videoProgress, quizAttempts,
reflections, notes, bookmarks, practices, assessments, capstone,
achievements, contentOverrides, metadata).

Synchronous mirror: the original `localStorage` key `kad-growth.open.v1`
is kept as a write-through mirror so the UI never blocks on async I/O and
existing backups keep working.

## Honest guarantees

Survives on the same browser + origin: tab close, browser close, normal
device restart. Requested via `navigator.storage.persist()` on HTTPS where
supported; the Settings → Storage health panel shows IndexedDB status,
persistence state, stored-data estimate, and last save time.

Does NOT survive: browser-data deletion, private browsing, device or
browser change, or domain change. Only a future authenticated backend can
move records across devices. Nothing here is presented otherwise.

## Autosave and safety

Writes are debounced on every meaningful action (video progress every few
seconds, quiz answers, reflections, practices, notes, bookmarks, settings)
and flushed on `pagehide` and `visibilitychange` (hidden-tab playback never
counts toward coverage). Imports are schema-validated, size-bounded,
prototype-key rejected, and ID-filtered against the known curriculum.
Exports carry an integrity checksum plus device ID; mismatched files are
rejected. Import shows a device-vs-backup comparison with Merge (union of
watched seconds, maximum scores, combined notes) or Replace options.
