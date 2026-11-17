# Profile customization

## Artwork without uploads

Open your profile, choose Customize profile, then Appearance. The profile-picture and banner buttons in the header choose the image target. Select a title from Your library or Catalogue to use its cover. For AniList anime and VNDB novels, the exact title ID loads its character artwork beneath the title picker; selecting a character sets that portrait as the profile picture. Kitsu covers are supported, but character associations are not guessed from title similarity. Global character search is also available.

Framing supports dragging, keyboard-accessible horizontal/vertical sliders, zoom and reset. All image choices, crops and profile settings remain a draft until Save profile. Discard confirmation is inline, not a browser dialog. The editor follows the current app theme; the saved public profile accent remains independent.

Favorites can appear as one Favorite media shelf or separate anime/VN shelves. Character favorites remain separate. In combined mode, Layout treats media as one visible/reorderable section. Selecting artwork/favorites does not change library tracking.

## Enabling file uploads later

The current deployed preview deliberately hides file-upload controls. Catalogue artwork does not require Storage or a billing upgrade.

1. The owner must upgrade Firebase project `anilog-10335` from Spark to Blaze and create its default Firebase Storage bucket. This is a billing action for the owner, not an automatic app change. Cloud Run's hosting project is a different project; enabling billing there does not enable this Firebase bucket.
2. Verify that the actual bucket matches the app's `VITE_FIREBASE_STORAGE_BUCKET` configuration. Deploy `storage.rules` using the main branch's Deploy Firebase Profile Rules workflow with `include_storage=true`; do not enable test/public-write rules. The deployment account may need narrowly scoped bucket-discovery permissions in the Firebase project, separately from its existing Rules Admin role.
3. Set `VITE_PROFILE_UPLOADS_ENABLED=true` at build time for preview, deploy, and test with a non-production profile before enabling it on the official frontend. Keep the flag off until bucket access and the rules are verified.
4. Verify accepted JPEG/PNG/WebP input, rejected SVG/oversized input, WebP conversion, save-conflict rollback and replaced-image cleanup against the real configured bucket. Existing local emulator tests cover these paths, but are not proof of a working hosted bucket.

Official setup requirements: https://firebase.google.com/docs/storage/web/start

## Verification

`npm run check` includes profile normalization, safe bio rendering, exact-provider character selection, spoiler/unsafe-image filtering, artwork selection accessibility, combined-layout ordering, transaction conflict handling and image cleanup tests. Browser review additionally covers all four editor views at 320/390/768/1280px, selection/crop/save/reopen, keyboard navigation and inline discard. Use the isolated demo Firebase configuration for write-heavy tests; do not overwrite the owner's real profile during QA.
