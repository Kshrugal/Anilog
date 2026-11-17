# Profile customization

## Profile images

Appearance now uses uploads only. The profile-picture and banner buttons choose the image target. Existing saved catalogue artwork and cover-collage backgrounds remain readable; changing the image never changes the library or favorites. Catalogue and character search remain available in Favorites, not the image editor.

Framing supports dragging, keyboard-accessible horizontal/vertical sliders, zoom and reset. All image choices, crops and profile settings remain a draft until Save profile. Discard confirmation is inline, not a browser dialog. The editor follows the current app theme; the saved public profile accent remains independent.

Favorites can appear as one Favorite media shelf or separate anime/VN shelves. Character favorites remain separate. In combined mode, Layout treats media as one visible/reorderable section. Selecting artwork/favorites does not change library tracking.

## Storage setup and release

Firebase project `anilog-10335` is on Blaze. Its default bucket is `anilog-10335.firebasestorage.app`, in `US-CENTRAL1`. Cloud Run hosting uses a different project; never substitute that project for the Firebase backend.

1. Run the existing Deploy Firebase Profile Rules workflow from the `preview` ref with `include_storage=true`. The Admin SDK publishes and reads back both rulesets using the deployment account's existing Rules Admin role. It does not need database or bucket-admin access. The script refuses a different project or bucket.
2. Preview builds set `VITE_PROFILE_UPLOADS_ENABLED=true`. The official frontend is not automatically promoted. Both use the existing account/backend, with private libraries and journals protected by Firestore rules.
3. Inputs accept nonempty JPEG/PNG/WebP up to 8 MB and 40 million pixels, resize to a maximum 2048-pixel edge, and encode actual WebP before saving. Storage accepts only immutable owner-path `.webp` objects up to 5 MB. Profile images are intentionally public; listing, creating, and deleting objects require their owner. Other paths are denied.
4. Images upload on Save, not selection. Identity and favorites commit atomically with a revision check. Failed saves remove new objects; successful saves remove replaced images and retry old orphans while preserving another tab's recent uploads. Do not overwrite the real owner's profile during QA.

Official setup requirements: https://firebase.google.com/docs/storage/web/start

## Component boundaries and performance

- `ProfileIdentityEditor.tsx` owns the draft, dialog, save/discard behavior, and editor tabs.
- `ProfileImageEditor.tsx` owns upload controls, framing, and animation-frame-batched crop gestures.
- `profile-storage.ts` validates/encodes images and coordinates uploads, transactions, and cleanup.
- `ProfileArtworkPicker.tsx` and `ProfileShowcases.tsx` are used for favorites only.
- `styles/tailwind.css`, `tailwind.config.js`, and `postcss.config.js` compile styles during the build, replacing browser-time CDN compilation. Keep generated theme focus classes in the safelist.
- Home caches unchanged library card elements across modal interactions and keeps card instances when sorting. Navigation retains fade/slide, without the full-page blur. Card tilt, sheen, stars, and hover effects are preserved.

## Verification

`npm run check` covers profile normalization, safe bio rendering, favorite-search filtering/accessibility, combined-layout ordering, crop batching, file validation/conversion, transaction conflict handling, cleanup, and built stylesheet/route checks. Local browser tests cover avatar/banner upload, crop, save, reload, narrow-phone layouts, favorites, bio, and title-modal interactions. `npm run test:security` covers private data and owner-only upload permissions. Hosted rule publication is separately verified by reading back the applied source; emulator tests alone are not proof of a working hosted bucket. A real-account hosted image save must be tested with an image chosen by the owner, not a disposable QA image.
