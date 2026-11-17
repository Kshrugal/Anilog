# Phase 2: profile identity and showcases

## Included

- Public avatar/banner identity with image uploads, nondestructive focal positioning and zoom, catalogue artwork, or a cover collage.
- Safe text-only bio formatting (bold, italic and closed-by-default spoilers), five independent profile accents, and overview visibility/order.
- Separate anime, visual novel and character showcases, up to eight items each. AniList and VNDB search, duplicate prevention, accessible ordering/removal, and direct catalogue links. Selecting a showcase never adds or changes a library entry.
- Desktop/mobile editor previews and a visitor mode that reads the public library projection, respects explicit library visibility, and hides owner actions.
- Existing Hall of Fame remains available as a fallback when no anime/VN showcases are selected; its original records are not deleted.
- Creator/support footer removed.

## Data boundaries

Paths below are relative to `artifacts/{appId}`:

| Path | Contents | Access |
| --- | --- | --- |
| `public/data/profileIdentity/{uid}` | Bio, image references/crops, accent, module order and revision | Public read, owner validated write |
| `public/data/profileIdentity/{uid}/showcases/{kind}` | Validated catalogue items and matching revision | Public read, owner write |
| `public/data/users/{uid}` | Existing public username, following, legacy favorites and library visibility | Public read, owner validated write |
| `public/data/users/{uid}/animeList/{id}` | Original full library, including journal notes and private tracking fields | Owner only, despite the legacy path name |
| `public/data/users/{uid}/publicLibrary/{id}` | Explicit, typed public projection without notes, routes, private tags or sharing settings | Owner, or visitors only while `libraryPublic` is explicitly true |
| `privateUsers/{uid}/settings/appearance` | Private app appearance preferences | Owner only |
| `privateUsers/{uid}/journal/{id}` | Reserved private journal documents | Owner only |

Existing journal notes stay in the now-private original library; no destructive migration is needed. Public identity/showcases are intentionally public even with a private library. Existing explicitly published social posts remain public; hiding an overview module is not deletion of those posts.

Identity and all three showcase records are saved in one transaction. Revision checks reject stale editors. Separate showcase records keep fully populated profiles within Firestore's rule-evaluation limit.

Uploads accept JPEG/PNG/WebP up to 8 MiB in the editor, decode and re-encode to WebP (maximum edge 2048px, maximum output 5 MiB), and strip original metadata. Storage validates owner path, immutable filename, MIME type and size. Storage rules do not inspect binary signatures; re-encoding is client-side. Profile images are public assets, not private file storage.

Replaced images are deleted only after the profile transaction commits. Failed saves remove their new uploads; successful saves retry orphan cleanup. A one-hour grace period protects concurrent, not-yet-committed uploads. Cleanup failures are surfaced and retried on the next save; this is not a scheduled server-side garbage collector.

The owner app reconciles the public projection once on connection, then writes only changed/deleted entries. Original library data is never spread into a public record. There is no fallback that exposes the original library if projection sync fails.

## Local review

Requires Node and Java 21. On this laptop Java is installed at `/opt/homebrew/opt/openjdk@21`.

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
npm ci
npx firebase emulators:start --project demo-anilog --only auth,firestore,storage
```

In separate terminals:

```sh
node scripts/seed-profile-review.mjs
VITE_LOCAL_FIREBASE=true npm run dev -- --host 127.0.0.1 --port 5175
```

Demo-only credentials: `review@anilog.local` / `AnilogReview123!`. Do not use a real account or password. `VITE_LOCAL_FIREBASE` works only in development and replaces the entire Firebase configuration with `demo-anilog`; it does not read or write live Firebase data. The seed script uses public catalogue metadata and writes only to local emulators. Restarting emulators without an export clears this demo data.

## Verification

```sh
npm run check
npm run test:security
```

Run the security command with the review emulators stopped, since it starts its own isolated test instances. The security suite includes visitors/strangers denied original library, journal and settings reads; validated public projections; invalid identity/showcase writes; a full 24-item atomic save; upload size/type/ownership checks; overwrite denial; and owner cleanup.

Browser review covers real uploads and deletion, keyboard crop adjustments, saved/reopened bio and favorites, both character providers, module ordering/visibility, visitor controls, and 390px mobile layout. No real user data is used.

## Deployment gate

**Do not deploy these rules to the currently shared preview/production Firebase project on their own.** The old production frontend still reads other users' original library documents, which these rules correctly deny. Cloud Run preview and production sharing a Firebase backend is not a security-isolated staging environment.

Before a hosted release:

1. Test against a separate Firebase staging project with its own Auth, Firestore and Storage configuration and disposable accounts. Deploy both rule files there, and verify the configured Storage bucket and CORS behavior.
2. Back up and audit existing public user documents. Move any unexpected private fields out of public documents, remove legacy public email fields, and validate required UID/username fields before enforcing the stricter profile schema. Do not silently drop unknown data.
3. Backfill `publicLibrary` using the same typed projection for existing accounts so visitors do not need to wait for each owner to sign in. Keep absent `libraryPublic` flags private unless explicitly opted in. Validate that projections contain no private fields, including nested objects.
4. Coordinate the compatible frontend and rules rollout. Existing old tabs cannot maintain the new projection; prompt/reload old clients during rollout. Never restore public access to original journal-bearing documents as a compatibility workaround.
5. Recheck real-account sign-in, privacy toggles, uploads, replacement cleanup, public profile/library/statistics and a stale-tab save conflict in staging before production approval.

This phase does not deploy infrastructure, publish to production, or implement the later home/settings redesign.
