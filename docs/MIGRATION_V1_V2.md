# Migration v1 → v2 · الترحيل

## What changes

- Schema `1` → `2`. Old backups still validate: they are migrated in memory.
- `language: null` on truly fresh installs triggers the first-run language
  gate. Switching language later never deletes progress.
- Every lesson keeps its stable ID and gains a canonical identity
  `leadership.<moduleId>.<lessonId>` for future ar/en variant mapping.
  Watch coverage stays per lesson ID; no history is rewritten.
- Manual viewing credit (`selfConfirmed`) ends. Migrated records keep quiz
  attempts, reflections, notes, bookmarks, and practices untouched; lessons
  completed only through self-confirmation return to "viewing remaining"
  instead of receiving fabricated watch data. Each migration appends an
  audit entry (`migratedFrom`, counts, timestamp).

## Guarantees

Idempotent: running migration twice changes nothing the second time. The
original `localStorage` entry is never deleted before a successful write.
A backup snapshot should be exported from Settings before major changes.
No silent substitution: Arabic lessons never fall back to English resources
and vice versa; mismatched direct links show an explanatory notice.
