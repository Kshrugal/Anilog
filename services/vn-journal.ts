export const VN_RUN_LIMIT = 20;
export const VN_ROUTE_LIMIT = 40;
export const VN_ENDING_LIMIT = 60;
export const VN_SESSION_LIMIT = 500;
export const VN_MILESTONES = { reading: 'In progress', main: 'Main story finished', full: 'Fully cleared' } as const;
export const VN_ROUTE_STATES = { planned: 'Not started', reading: 'Reading', finished: 'Finished' } as const;

export type VnRoute = { id: string; name: string; state: keyof typeof VN_ROUTE_STATES };
export type VnSession = { id: string; date: string; minutes: number; routeId: string };
export type VnEnding = { id: string; name: string; unlocked: boolean };
export type VnRun = { id: string; name: string; platform: string; milestone: keyof typeof VN_MILESTONES; bookmark: string; routes: VnRoute[]; endings: VnEnding[]; sessions: VnSession[] };
export type VnJournal = { version: 1; revision: number; baselineMinutes: number; baselineEndings: number; activeId: string; runs: VnRun[] };

const bounded = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(id);
export function vnDateValid(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const newVnRun = (id: string, name: string): VnRun => ({ id, name, platform: '', milestone: 'reading', bookmark: '', routes: [], endings: [], sessions: [] });
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(item => [item.id, item])).values()];

export function readVnJournal(entry?: Record<string, any> | null): VnJournal {
  const saved = entry?.vnJournal;
  if (saved?.version === 1) {
    const runs = unique<VnRun>(list(saved.runs).filter(run => validId(run?.id)).slice(0, VN_RUN_LIMIT).map(run => {
      const routes = unique<VnRoute>(list(run.routes).filter(route => validId(route?.id) && clean(route.name, 80)).slice(0, VN_ROUTE_LIMIT).map(route => ({
        id: route.id, name: clean(route.name, 80), state: Object.hasOwn(VN_ROUTE_STATES, route.state) ? route.state : 'planned',
      })));
      const sessions = unique<VnSession>(list(run.sessions).filter(row => validId(row?.id) && vnDateValid(row.date) && bounded(row.minutes, 1440) > 0).slice(0, VN_SESSION_LIMIT).map(row => ({
        id: row.id, date: row.date, minutes: bounded(row.minutes, 1440), routeId: routes.some(route => route.id === row.routeId) ? row.routeId : '',
      })));
      const endings = unique<VnEnding>(list(run.endings).filter(ending => validId(ending?.id) && clean(ending.name, 80)).slice(0, VN_ENDING_LIMIT).map(ending => ({
        id: ending.id, name: clean(ending.name, 80), unlocked: ending.unlocked === true,
      })));
      return { ...newVnRun(run.id, clean(run.name, 80) || 'Playthrough'), platform: clean(run.platform, 40), bookmark: clean(run.bookmark, 500),
        milestone: Object.hasOwn(VN_MILESTONES, run.milestone) ? run.milestone : 'reading', routes, endings, sessions };
    }));
    if (runs.length) return { version: 1, revision: bounded(saved.revision, Number.MAX_SAFE_INTEGER - 1), runs,
      activeId: runs.some(run => run.id === saved.activeId) ? saved.activeId : runs[0].id,
      baselineMinutes: bounded(saved.baselineMinutes, 6_000_000), baselineEndings: bounded(saved.baselineEndings, 9999) };
  }
  const run = newVnRun('first', 'First playthrough');
  const route = clean(entry?.vnRoute, 80);
  run.platform = clean(entry?.platform, 40);
  if (route) run.routes.push({ id: 'previous-route', name: route, state: 'reading' });
  if (entry?.status === 'completed') run.milestone = 'main';
  return { version: 1, revision: 0, baselineMinutes: bounded(Number(entry?.vnPlaytimeHours || 0) * 60, 6_000_000),
    baselineEndings: bounded(Number(entry?.vnEndingsCompleted || 0), 9999), activeId: run.id, runs: [run] };
}

export function vnTotals(journal: VnJournal) {
  return {
    minutes: journal.baselineMinutes + journal.runs.reduce((sum, run) => sum + run.sessions.reduce((total, row) => total + row.minutes, 0), 0),
    completedRoutes: journal.runs.reduce((sum, run) => sum + run.routes.filter(route => route.state === 'finished').length, 0),
    unlockedEndings: journal.baselineEndings + journal.runs.reduce((sum, run) => sum + run.endings.filter(ending => ending.unlocked).length, 0),
  };
}

export function vnJournalFields(journal: VnJournal) {
  const vnJournal = readVnJournal({ vnJournal: journal });
  const run = vnJournal.runs.find(item => item.id === vnJournal.activeId);
  const totals = vnTotals(vnJournal);
  return { vnJournal: { ...vnJournal, revision: vnJournal.revision + 1 }, vnPlaytimeHours: totals.minutes / 60,
    vnEndingsCompleted: totals.unlockedEndings, platform: run?.platform || '',
    vnRoute: run?.routes.find(route => route.state === 'reading')?.name || '' };
}
