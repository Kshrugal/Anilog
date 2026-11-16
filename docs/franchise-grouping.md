# Franchise Identity and Public Statistics

## Identity and Membership

`services/franchises.ts` separates a series/franchise from its umbrella universe.
Fate, Tsukihime, The Garden of Sinners, and Witch on the Holy Night retain their
own series identities while rolling up into TYPE-MOON in Universe view.

Membership combines:

- Exact AniList IDs and exact Kitsu-to-AniList/MAL mappings, never fuzzy search.
- AniList source/adaptation, prequel/sequel, parent, side-story, spin-off,
  compilation, summary and alternative relationships. Anthology `CONTAINS` edges
  are excluded because an anthology is not necessarily one franchise.
- Official VNDB relationships. VNDB `set` and AniList `SAME_UNIVERSE` join only
  the umbrella graph, not the individual series graph.
- A small reviewed alias/identity registry for renamed branches and cross-media
  families, plus exact TYPE-MOON developer IDs for its creator umbrella.
- Original-author/scenario credits as inspectable supporting evidence.
- Unregistered cross-provider adaptations can join when an exact, unique title
  alias and an original-work creator/developer credit both agree. Same-name works
  without corroborating original credits remain separate.

Shared studios, directors, authors, composers, `CHARACTER` cameos, generic
`OTHER` edges, and unofficial VN relations do not independently merge series.
Distinct reviewed families are protected across entire connected components,
including indirect paths through unlabelled crossover/anthology hubs.
Unconfirmed title-suffix fallbacks are labeled rather than presented as verified.

The resolver retains Unicode identities and has deterministic union roots. The
canonical label prefers reviewed identities, then source/parent/prequel roots,
then release year and stable tie-breakers. Manga can connect adaptations without
being inserted into the user's library. Only actual saved entries contribute to
group totals; changing series/universe views cannot multiply their time.

## Fetching and Caching

`services/franchise-catalogue.ts` batches AniList and VNDB public metadata, spaces
requests, serializes scans, deduplicates concurrent identical scans, and caches
at most 2,000 public nodes for seven days in browser storage. An additional bounded
source/prequel hop can bridge records through untracked source works. Kitsu
mapping work is capped at 100 missing identities per scan; another check continues
from successfully cached mappings. Failed requests are not cached as successes.

The cache contains public media metadata only: no user IDs, scores, progress,
notes, credentials, or private library associations. Coverage reports successfully
retrieved identities, not a guarantee that every catalogue relationship is correct.
API outages and rate limits preserve reviewed identities and available cache.

## Runtime Accounting

Cache version 2 includes each anime listing's catalogue duration, episode count,
format, release status, and available aired-episode count. AniList runtime takes
precedence over older saved metadata; exact Kitsu mappings can fall back to Kitsu
runtime when AniList has none. Missing runtimes are not replaced with 24 minutes.
They are visibly excluded from known-time totals and the backlog calculator.

Completed finished titles use their episode count; unfinished entries use recorded
progress, bounded by known totals and aired episodes. Optional rewatches add full
known completed cycles. Films use their own runtime. TV uses the catalogue's general
per-episode duration, so skipped credits and unusually long episodes are not stopwatch
accurate. Visual novels and manga use logged hours only, never progress guesses.
The Runtimes audit exposes exact minutes, calculation, source, and missing metadata.
Personal and public profiles, franchise totals, and Time Lab share this calculation.

## Public Profiles

Public statistics receive only the target profile's already-authorized library.
The private-library gate also guards statistics, media dialogs, and cover art.
Visitors can explore filters and estimates but cannot edit grouping overrides.
Personal browser overrides are not applied to somebody else's public statistics.
An owner's existing local overrides remain independent from account/library data.

## Sources

- [AniList Media relationships](https://docs.anilist.co/reference/object/media)
- [AniList relation types](https://docs.anilist.co/reference/enum/mediarelation)
- [VNDB Kana API: relations, developers, and staff](https://api.vndb.org/kana)
- [TYPE-MOON's official products](https://www.typemoon.com/products/)

Live public API checks validated Naruto, Bleach, their source manga, and Tsukihime.
Regression fixtures cover cross-format identities, unfamiliar graph paths,
unofficial derivatives, cameo exclusions, shared-staff false positives, persistent
cache reuse, inflight deduplication, exact Kitsu mapping, and rate-limit recovery.
