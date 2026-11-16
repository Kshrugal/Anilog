export type LibraryEntry = Record<string, any>;
export const finite = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export const entryId = (entry: LibraryEntry) => String(entry.kitsuId || entry.id || '');
export const visualNovel = (entry: LibraryEntry) => entry.mediaType === 'vn' || entry.showType === 'Visual Novel' || entryId(entry).startsWith('v');
export const mangaEntry = (entry: LibraryEntry) => ['manga', 'novel'].includes(entry.mediaType) || entry.type === 'MANGA' || entry.attributes?.type === 'MANGA';
export const statusOf = (entry: LibraryEntry) => ({ planning: 'planned', on_hold: 'paused', reading: 'watching' }[entry.status] || entry.status || 'planned');

// Retained exactly to make the previous official counter reproducible.
export function legacyGroup(title = '') {
  return String(title || '').toLowerCase().replace(/season \d+/g, '').replace(/\d+(st|nd|rd|th) season/g, '').replace(/the final season/g, '').replace(/part \d+/g, '').replace(/cour \d+/g, '').replace(/ ii/g, '').replace(/ iii/g, '').replace(/:\s*$/, '').replace(/[^a-z0-9]/g, '').trim();
}

export function suggestedGroup(title = '') {
  return titleFallback(title);
}

export function timeFor(entry: LibraryEntry, repeats = false) {
  if (mangaEntry(entry)) return { minutes: finite(entry.readingTimeHours) * 60, episodes: 0, estimated: false };
  if (visualNovel(entry)) return { minutes: finite(entry.vnPlaytimeHours) * 60, episodes: 0, estimated: false };
  const total = finite(entry.totalEpisodes || entry.episodeCount || entry.attributes?.episodeCount);
  const progress = finite(entry.watchedEpisodes);
  const episodes = (statusOf(entry) === 'completed' && total ? total : total ? Math.min(progress, total) : progress) + (repeats && total ? Math.floor(finite(entry.repeatCount)) * total : 0);
  const duration = finite(entry.durationMinutes || entry.attributes?.episodeLength);
  return { minutes: episodes * (duration || 24), episodes, estimated: !duration && episodes > 0 };
}

export function analyze(entries: LibraryEntry[], overrides: Record<string, string> = {}, repeats = false, options: { catalogue?: Catalogue; grouping?: 'franchise' | 'universe' } = {}) {
  const memberships = resolveMemberships(entries, options.catalogue);
  const groups = new Map<string, { id: string; name: string; entries: LibraryEntry[]; minutes: number; completed: number; scores: number[]; franchises: string[] }>();
  const statuses: Record<string, number> = { watching: 0, completed: 0, planned: 0, paused: 0, dropped: 0 };
  const buckets = Array.from({ length: 10 }, () => [] as LibraryEntry[]);
  const years: Record<string, { entries: LibraryEntry[]; minutes: number }> = {};
  const genres: Record<string, { count: number; minutes: number }> = {};
  let minutes = 0, episodes = 0, estimatedTitles = 0, missingVnTime = 0;
  const completedAnime = entries.filter(e => !visualNovel(e) && !mangaEntry(e) && statusOf(e) === 'completed');
  const scores: number[] = [];
  let undatedCompleted = 0;
  for (const entry of entries) {
    const time = timeFor(entry, repeats);
    minutes += time.minutes;
    episodes += time.episodes;
    estimatedTitles += Number(time.estimated);
    missingVnTime += Number(visualNovel(entry) && !finite(entry.vnPlaytimeHours) && statusOf(entry) !== 'planned');
    const status = statusOf(entry);
    statuses[status] = (statuses[status] || 0) + 1;
    const score = finite(entry.score);
    if (score > 0 && score <= 10) { scores.push(score); buckets[Math.max(0, Math.ceil(score) - 1)].push(entry); }
    const membership = memberships[entryId(entry)];
    const custom = overrides[entryId(entry)]?.trim();
    const universe = options.grouping !== 'franchise';
    const name = custom || (universe ? membership.universe : membership.franchise);
    const key = custom ? `custom:${custom.toLocaleLowerCase()}` : universe ? membership.universeKey : membership.franchiseKey;
    const group = groups.get(key) || { id: key, name, entries: [], minutes: 0, completed: 0, scores: [], franchises: [] };
    if (!group.franchises.includes(membership.franchise)) group.franchises.push(membership.franchise);
    group.entries.push(entry); group.minutes += time.minutes; group.completed += Number(status === 'completed');
    if (score > 0 && score <= 10) group.scores.push(score);
    groups.set(key, group);
    for (const genre of new Set<string>(Array.isArray(entry.genres) ? entry.genres : [])) {
      const row = genres[genre] || { count: 0, minutes: 0 };
      row.count++; row.minutes += time.minutes; genres[genre] = row;
    }
    if (status === 'completed') {
      const date = typeof entry.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.completedAt) ? new Date(`${entry.completedAt}T00:00:00Z`) : null;
      if (date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === entry.completedAt) {
        const year = entry.completedAt.slice(0, 4);
        const row = years[year] || { entries: [], minutes: 0 }; row.entries.push(entry); row.minutes += time.minutes; years[year] = row;
      } else undatedCompleted++;
    }
  }
  scores.sort((a, b) => a - b);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const median = scores.length ? (scores[Math.floor((scores.length - 1) / 2)] + scores[Math.ceil((scores.length - 1) / 2)]) / 2 : 0;
  return { minutes, episodes, estimatedTitles, missingVnTime, statuses, buckets, years, genres, undatedCompleted, mean, median, rated: scores.length, completedAnime: completedAnime.length, completedVns: entries.filter(e => visualNovel(e) && statusOf(e) === 'completed').length, completedManga: entries.filter(e => mangaEntry(e) && statusOf(e) === 'completed').length, legacyCompletedGroups: new Set(completedAnime.map(e => legacyGroup(e.title))).size, groups: [...groups.values()], memberships };
}

export function remainingAnime(entries: LibraryEntry[]) {
  let minutes = 0, unknown = 0;
  for (const entry of entries.filter(e => !visualNovel(e) && !mangaEntry(e) && ['watching', 'paused', 'planned'].includes(statusOf(e)))) {
    const total = finite(entry.totalEpisodes || entry.episodeCount || entry.attributes?.episodeCount);
    if (!total) { unknown++; continue; }
    minutes += Math.max(0, total - finite(entry.watchedEpisodes)) * (finite(entry.durationMinutes || entry.attributes?.episodeLength) || 24);
  }
  return { minutes, unknown };
}
import { resolveMemberships, titleFallback, type Catalogue } from './franchises';
