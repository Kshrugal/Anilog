import { profileEntry, profileIsVn, profileLibrary } from './profile';
import { nextProgress } from './tracking';

export function resumeQueue(entries: any[], media = 'all') {
  return profileLibrary(entries, media, 'watching').items.map(profileEntry).filter(entry => nextProgress(entry) !== null);
}

export function homeStatusLabel(status: string, media = 'all') {
  if (status === 'all') return 'All titles';
  if (status === 'watching') return media === 'vn' ? 'Reading' : media === 'anime' ? 'Watching' : 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function progressCommand(entry: any) {
  const next = nextProgress({ ...entry, mediaType: profileIsVn(entry) ? 'vn' : 'anime' });
  if (!next) return null;
  return profileIsVn(entry) ? `Log ${next.progress - Math.max(0, Number(entry.watchedEpisodes) || 0)}% read` : `Log episode ${next.progress}`;
}

export function normalizeSavedViews(value: unknown) {
  if (!Array.isArray(value)) return [];
  const allowed = { statusFilter: ['all', 'watching', 'completed', 'planned', 'paused', 'dropped'], mediaFilter: ['all', 'anime', 'vn'], collectionFilter: ['all', 'favorites', 'priority', 'unrated', 'stale'], sortBy: ['updated', 'score', 'title'], viewMode: ['grid', 'list', 'journal'] };
  return value.filter(view => view && ['number', 'string'].includes(typeof view.id) && typeof view.name === 'string' && view.config && Object.entries(allowed).every(([key, options]) => options.includes(view.config[key])) && typeof view.config.tagFilter === 'string').slice(-5).map(view => ({ id: view.id, name: view.name.slice(0, 100), config: { ...Object.fromEntries(Object.keys(allowed).map(key => [key, view.config[key]])), tagFilter: view.config.tagFilter.slice(0, 100) } }));
}

export function libraryStatusCounts(entries: any[], media = 'all') {
  return profileLibrary(entries, media).counts;
}

