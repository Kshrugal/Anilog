# Phase 3A: practical homepage

This release stays on the existing `preview` branch and Cloud Run preview. It does not promote the official frontend or change Firebase schemas, rules, accounts, or sharing preferences.

## Profile finishing pass

- Visitor view remains useful for checking actual public-library access. Its native checkbox is replaced by an eye-icon action with a tooltip; only an explicit exit and a quiet status line remain while previewing.
- The banner has a softened edge and fade, with the avatar overlapping its lower edge. Identity, library counts, and the bio share one introduction area.
- A default first-position bio appears in that introduction rather than a duplicate About section. Existing deliberately reordered bios retain their chosen body position. Visibility, safe formatting, spoilers, and public accent colors remain intact.
- Long introductions have an accessible expand/collapse control. Editor appearance previews reuse the public header and respond to their own container width.

## Home

- The existing visual family remains: image-led resume panel, hover/tilt cards, dock, filters, Journal, and library tools.
- The resume selector switches among unfinished in-progress anime and VNs, using existing private library records only. Completed progress is excluded from the resume queue without silently changing the saved status.
- Logging actions explicitly say `Log episode N` or the actual VN percentage increment. Opening or selecting a title does not record progress.
- Pending progress writes disable repeat submissions per title. Transactions still reread the current entry; separate tabs retain concurrent-write safety. Failures release the pending state and do not recreate deleted records.
- Status counts are individual library records within the selected media type, not franchises. All titles supports searching across statuses. Search and sorting reuse the public-profile library helpers, including alternate names and normalized Unicode.
- Compact controls, a visible Add title command, result counts, and removable collection/tag filters reduce navigation overhead. Advanced filters, saved views, bulk actions, and Journal remain available.
- Saved views are validated before use. A user-keyed Home mount prevents local view state from carrying between accounts.
- An outgoing grid can keep its fade animation but is inert, hidden from assistive technology, and cannot intercept input.

## Boundaries and verification

`services/home-library.ts` contains pure queue, count, command-label, and saved-view helpers. `features/HomeResume.tsx` owns the resume presentation; `features/LibraryGrid.tsx` isolates animation-presence behavior. Home still owns its Firestore subscription and transactional writes.

`npm run check` includes `test:home`, transaction concurrency/pending tests, profile introduction/visitor controls, safe bio rendering, existing tracking/analytics contracts, TypeScript, build, and production-route checks. Security tests remain separate. Write-heavy browser testing uses the local `demo-anilog` account, never the owner's actual account.

Settings customization remains the next reviewable phase, not part of this release.
