# Account data and legacy showcase retirement

The preview no longer reads or writes Hall of Fame for display, editing, export, or library reset. The profile editor's Favorite Media, Anime, Visual Novels, and Characters showcases are unchanged. Legacy fields remain in storage so the existing official release can still operate. No migration or bulk deletion is performed. Retire the write permission only after the official client no longer depends on it.

Settings opens without downloading deck collections, the private library, activity history, or catalogue metadata. Library views load their own data when opened. Exports run only on demand, reread the signed-in owner's library from the server, query activity and decks by owner, and include the current profile customization and local display preferences. They do not upload the resulting file or copy another user's replies. Avatar and banner references are included, not the image binaries.

The export verifies the same authenticated session before and after reading, refuses incomplete server reads or mismatched showcase revisions, and is guarded against repeat clicks. The reset path still uses fresh server reads, optional backup, and transactional record comparison before deleting. It no longer mutates profile data.

After preview review, the next release step is a production readiness pass: shared-rule compatibility, signed-in and guest flows, and rollback verification before promotion. No further product phase has been scheduled.
