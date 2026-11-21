import { useState } from 'react';
import { ChevronDown, Clock, Flag, GitBranch, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { newVnRun, vnDateValid, vnJournalWithTotal, vnTotals, VN_ENDING_LIMIT, VN_MILESTONES, VN_ROUTE_LIMIT, VN_ROUTE_STATES, VN_RUN_LIMIT, VN_SESSION_LIMIT, type VnJournal as Journal, type VnRun, type VnSession } from '../services/vn-journal';

const field = 'min-h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#10121a] px-3 py-2 text-sm text-white';
const label = 'grid min-w-0 gap-1.5 text-xs font-medium text-gray-300';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-cyan-100 hover:bg-white/10 disabled:opacity-40';
const iconButton = 'grid h-10 w-10 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white';
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const time = (minutes: number) => [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : '', minutes % 60 ? `${minutes % 60}m` : ''].filter(Boolean).join(' ') || '0m';

export function VnJournal({ journal, onChange, onSave, busy = false }: { journal: Journal; onChange: (journal: Journal) => void; onSave: (journal: Journal) => Promise<boolean>; busy?: boolean }) {
  const [removeRunId, setRemoveRunId] = useState('');
  const [mode, setMode] = useState<'session' | 'total' | null>(null);
  const [duration, setDuration] = useState('');
  const [invalid, setInvalid] = useState('');
  const run = journal.runs.find(item => item.id === journal.activeId) || journal.runs[0];
  const totals = vnTotals(journal);
  const allSessions = journal.runs.reduce((sum, item) => sum + item.sessions.length, 0);
  const canAddSession = run.sessions.length < VN_SESSION_LIMIT && allSessions < 2000;
  const changeRun = (next: VnRun) => onChange({ ...journal, runs: journal.runs.map(item => item.id === next.id ? next : item) });
  const addRun = () => {
    if (journal.runs.length >= VN_RUN_LIMIT) return;
    const next = newVnRun(crypto.randomUUID(), `Replay ${journal.runs.length}`);
    setRemoveRunId('');
    onChange({ ...journal, activeId: next.id, runs: [...journal.runs, next] });
  };
  const removeRun = () => {
    const runs = journal.runs.filter(item => item.id !== run.id);
    if (!runs.length) return;
    onChange({ ...journal, runs, activeId: runs[0].id });
    setRemoveRunId('');
  };
  const changeMode = (next: typeof mode) => {
    setMode(next === mode ? null : next);
    setInvalid('');
    setDuration(next === 'total' && totals.minutes > 0 ? String(Number((totals.minutes / 60).toFixed(4))) : '');
  };
  const saveTime = async () => {
    if (busy || !mode || !duration.trim()) return;
    const value = Number(duration);
    if (!Number.isFinite(value) || value < 0) { setInvalid('Enter a valid amount of time.'); return; }
    let next: Journal | null;
    if (mode === 'session') {
      if (!canAddSession || !Number.isInteger(value) || value < 1 || value > 1440) { setInvalid('Enter 1 to 1,440 minutes.'); return; }
      const session = { id: crypto.randomUUID(), date: today(), minutes: value, routeId: '' };
      next = { ...journal, runs: journal.runs.map(item => item.id === run.id ? { ...item, sessions: [...item.sessions, session] } : item) };
    } else {
      next = vnJournalWithTotal(journal, Math.round(value * 60));
      if (!next) { setInvalid(value * 60 < totals.minutes - journal.baselineMinutes ? 'That’s less than your saved sessions. Edit those in Session history first.' : 'Enter a valid total in hours.'); return; }
    }
    setInvalid('');
    if (await onSave(next)) { setMode(null); setDuration(''); }
  };
  return <fieldset aria-label="Reading journal" disabled={busy} className="mb-4 min-w-0 space-y-2 border-y border-white/10 py-3 disabled:opacity-60">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-gray-400"><Clock size={14} className="text-cyan-200" />Time spent</h3>
        <p aria-live="polite" className="mt-1 break-words text-xl font-semibold tabular-nums text-white">{time(totals.minutes)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-expanded={mode === 'total'} className={button} onClick={() => changeMode('total')}><Pencil size={14} />Set total</button>
        <button type="button" aria-expanded={mode === 'session'} disabled={!canAddSession} className={`${button} border border-white/15 bg-white/5 text-white`} onClick={() => changeMode('session')}><Plus size={15} />Log time</button>
      </div>
    </div>
    {mode && <div className="flex flex-wrap items-end gap-2 pt-2">
      <label className={`${label} flex-1 basis-32`}>{mode === 'total' ? 'Total hours' : 'Minutes today'}<input className={field} type="number" min={mode === 'total' ? 0 : 1} max={mode === 'total' ? undefined : 1440} step={mode === 'total' ? 'any' : 1} value={duration} onChange={event => { setDuration(event.target.value); setInvalid(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveTime(); } }} /></label>
      <button type="button" disabled={!duration.trim() || busy} onClick={saveTime} className={`${button} bg-white/10 text-white`}>{busy ? 'Saving…' : 'Save log'}</button>
      {invalid && <p role="alert" className="basis-full text-xs text-amber-200">{invalid}</p>}
    </div>}
    <details className="group/journal">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded px-1 py-2 text-xs font-semibold text-gray-400 hover:text-white [&::-webkit-details-marker]:hidden">Session history &amp; playthroughs<ChevronDown size={13} className="group-open/journal:rotate-180" /></summary>
      <div className="space-y-4 border-t border-white/10 pt-3">
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400"><span>{totals.completedRoutes} routes finished</span><span>{totals.unlockedEndings} endings unlocked</span><span className="ml-auto flex items-center gap-1.5"><Lock size={12} />Only you</span></div>
    <div className="flex flex-wrap items-end gap-2">
      <label className={`${label} basis-44 flex-1`}>Playthrough<select className={field} value={run.id} onChange={event => { onChange({ ...journal, activeId: event.target.value }); setRemoveRunId(''); }}>{journal.runs.map(item => <option key={item.id} value={item.id}>{item.name || 'Playthrough'}</option>)}</select></label>
      <button type="button" onClick={addRun} disabled={journal.runs.length >= VN_RUN_LIMIT} className={button}><Plus size={15} />New replay</button>
      {journal.runs.length > 1 && <button type="button" onClick={() => setRemoveRunId(removeRunId === run.id ? '' : run.id)} title="Remove playthrough" aria-label="Remove playthrough" aria-expanded={removeRunId === run.id} className={iconButton}><Trash2 size={15} /></button>}
    </div>
    {removeRunId === run.id && <div role="group" aria-label="Confirm playthrough removal" className="flex flex-wrap items-center gap-2 text-xs text-rose-200">Remove this playthrough and its sessions?<button type="button" onClick={removeRun} className={button}>Remove</button><button type="button" onClick={() => setRemoveRunId('')} className={button}>Cancel</button></div>}
    <VnPlaythrough key={run.id} run={run} change={changeRun} allSessions={allSessions} />
    <details className="border-t border-white/10 pt-3">
      <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-white">Previously logged time and endings</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={label}>Hours before sessions<input className={field} type="number" min="0" max="100000" step="any" value={Number((journal.baselineMinutes / 60).toFixed(4))} onChange={event => onChange({ ...journal, baselineMinutes: Math.round(Math.min(100000, Math.max(0, Number(event.target.value) || 0)) * 60) })} /></label>
        <label className={label}>Endings before this journal<input className={field} type="number" min="0" max="9999" value={journal.baselineEndings} onChange={event => onChange({ ...journal, baselineEndings: Math.floor(Math.min(9999, Math.max(0, Number(event.target.value) || 0))) })} /></label>
      </div>
    </details>
      </div>
    </details>
  </fieldset>;
}

function VnPlaythrough({ run, change, allSessions }: { run: VnRun; change: (run: VnRun) => void; allSessions: number }) {
  const [routeName, setRouteName] = useState('');
  const [endingName, setEndingName] = useState('');
  const [removeRouteId, setRemoveRouteId] = useState('');
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState('');
  const [routeId, setRouteId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [deleted, setDeleted] = useState<VnSession | null>(null);
  const [showAll, setShowAll] = useState(false);
  const canAddRoute = !!routeName.trim() && run.routes.length < VN_ROUTE_LIMIT && !run.routes.some(route => route.name.trim().toLowerCase() === routeName.trim().toLowerCase());
  const canAddEnding = !!endingName.trim() && run.endings.length < VN_ENDING_LIMIT && !run.endings.some(ending => ending.name.trim().toLowerCase() === endingName.trim().toLowerCase());
  const canAddSession = run.sessions.length < VN_SESSION_LIMIT && allSessions < 2000;
  const canSaveSession = vnDateValid(date) && date <= today() && /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 1440 && (editingId || canAddSession);
  const sorted = [...run.sessions].reverse().sort((a, b) => b.date.localeCompare(a.date));
  const resetSession = () => { setEditingId(''); setDate(today()); setMinutes(''); setRouteId(''); };
  const addRoute = () => {
    if (!canAddRoute) return;
    change({ ...run, routes: [...run.routes, { id: crypto.randomUUID(), name: routeName.trim(), state: 'planned' }] });
    setRouteName('');
  };
  const addEnding = () => {
    if (!canAddEnding) return;
    change({ ...run, endings: [...run.endings, { id: crypto.randomUUID(), name: endingName.trim(), unlocked: false }] });
    setEndingName('');
  };
  const saveSession = () => {
    if (!canSaveSession) return;
    const session = { id: editingId || crypto.randomUUID(), date, minutes: Number(minutes), routeId: run.routes.some(route => route.id === routeId) ? routeId : '' };
    change({ ...run, sessions: editingId ? run.sessions.map(row => row.id === editingId ? session : row) : [...run.sessions, session] });
    resetSession();
  };
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>Playthrough name<input maxLength={80} className={field} value={run.name} onChange={event => change({ ...run, name: event.target.value })} /></label>
      <label className={label}>Platform or edition<input placeholder="Steam, Switch, original release…" maxLength={40} className={field} value={run.platform} onChange={event => change({ ...run, platform: event.target.value })} /></label>
      <label className={label}>Milestone<select className={field} value={run.milestone} onChange={event => change({ ...run, milestone: event.target.value as VnRun['milestone'] })}>{Object.entries(VN_MILESTONES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      <label className={label}>Pick up at<input placeholder="Chapter, save slot, or scene…" maxLength={500} className={field} value={run.bookmark} onChange={event => change({ ...run, bookmark: event.target.value })} /></label>
    </div>
    <details className="border-t border-white/10 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-200"><GitBranch className="mr-2 inline text-cyan-200" size={15} />Routes{run.routes.length > 0 ? ` (${run.routes.length})` : ''}</summary>
      <div className="mt-3 space-y-2">
        {run.routes.map(route => <div key={route.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
          <input aria-label="Route name" maxLength={80} className={field} value={route.name} onChange={event => change({ ...run, routes: run.routes.map(item => item.id === route.id ? { ...item, name: event.target.value } : item) })} />
          <select aria-label={`Status for ${route.name}`} className={field} value={route.state} onChange={event => change({ ...run, routes: run.routes.map(item => item.id === route.id ? { ...item, state: event.target.value as typeof route.state } : item) })}>{Object.entries(VN_ROUTE_STATES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
          <button type="button" className={iconButton} title="Remove route" aria-label={`Remove ${route.name}`} aria-expanded={removeRouteId === route.id} onClick={() => setRemoveRouteId(removeRouteId === route.id ? '' : route.id)}><Trash2 size={15} /></button>
          {removeRouteId === route.id && <div className="col-span-3 flex flex-wrap items-center gap-2 text-xs text-gray-300">Keep its sessions and remove the route?<button type="button" className={button} onClick={() => { change({ ...run, routes: run.routes.filter(item => item.id !== route.id), sessions: run.sessions.map(row => row.routeId === route.id ? { ...row, routeId: '' } : row) }); if (routeId === route.id) setRouteId(''); setRemoveRouteId(''); }}>Remove route</button><button type="button" className={button} onClick={() => setRemoveRouteId('')}>Cancel</button></div>}
        </div>)}
        <div className="flex gap-2"><input aria-label="New route name" placeholder="New route" className={field} maxLength={80} value={routeName} onChange={event => setRouteName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRoute(); } }} /><button type="button" className={`${button} shrink-0`} onClick={addRoute} disabled={!canAddRoute}><Plus size={14} />Add route</button></div>
      </div>
    </details>
    <details className="border-t border-white/10 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-200"><Flag className="mr-2 inline text-cyan-200" size={15} />Endings{run.endings.length > 0 ? ` (${run.endings.filter(ending => ending.unlocked).length}/${run.endings.length})` : ''}</summary>
      <div className="mt-3 space-y-2">
        {run.endings.map(ending => <div key={ending.id} className="flex items-center gap-2">
          <input type="checkbox" aria-label={`Unlocked: ${ending.name}`} checked={ending.unlocked} className="h-5 w-5 shrink-0 accent-cyan-300" onChange={event => change({ ...run, endings: run.endings.map(item => item.id === ending.id ? { ...item, unlocked: event.target.checked } : item) })} />
          <input aria-label="Ending name" maxLength={80} className={field} value={ending.name} onChange={event => change({ ...run, endings: run.endings.map(item => item.id === ending.id ? { ...item, name: event.target.value } : item) })} />
          <button type="button" title="Remove ending" aria-label={`Remove ending ${ending.name}`} className={iconButton} onClick={() => change({ ...run, endings: run.endings.filter(item => item.id !== ending.id) })}><Trash2 size={15} /></button>
        </div>)}
        <div className="flex gap-2"><input aria-label="New ending name" placeholder="New ending" className={field} maxLength={80} value={endingName} onChange={event => setEndingName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addEnding(); } }} /><button type="button" className={`${button} shrink-0`} onClick={addEnding} disabled={!canAddEnding}><Plus size={14} />Add ending</button></div>
      </div>
    </details>
    <details className="border-t border-white/10 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-200"><Clock className="mr-2 inline text-cyan-200" size={15} />Sessions{run.sessions.length > 0 ? ` (${run.sessions.length})` : ''}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={label}>Date<input className={field} type="date" max={today()} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className={label}>Minutes<input className={field} type="number" min="1" max="1440" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
        {!editingId && <div className="flex flex-wrap gap-1 sm:col-span-2">{[15, 30, 60].map(value => <button key={value} type="button" className={button} aria-pressed={minutes === String(value)} onClick={() => setMinutes(String(value))}>{value} min</button>)}</div>}
        {run.routes.length > 0 && <label className={label}>Route<select className={field} value={routeId} onChange={event => setRouteId(event.target.value)}><option value="">No route</option>{run.routes.map(route => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>}
        <div className="flex flex-wrap items-end gap-2"><button type="button" className={`${button} bg-white/5`} disabled={!canSaveSession} onClick={saveSession}>{editingId ? <Pencil size={14} /> : <Plus size={14} />}{editingId ? 'Update session' : 'Add session'}</button>{editingId && <button type="button" className={button} onClick={resetSession}>Cancel</button>}</div>
      </div>
      {deleted && <button type="button" className={button} disabled={!canAddSession} onClick={() => { change({ ...run, sessions: [...run.sessions, deleted] }); setDeleted(null); }}>Undo session removal</button>}
      <ul className="mt-2 divide-y divide-white/10">
        {sorted.slice(0, showAll ? undefined : 5).map(row => <li key={row.id} className="flex items-center gap-2 py-1.5">
          <div className="min-w-0 flex-1"><time className="text-xs text-gray-400" dateTime={row.date}>{row.date}</time><p className="break-words text-sm text-gray-200">{run.routes.find(route => route.id === row.routeId)?.name || 'Reading session'}</p></div>
          <span className="shrink-0 text-xs font-semibold text-gray-300">{time(row.minutes)}</span>
          <button type="button" className={iconButton} title="Edit session" aria-label={`Edit session on ${row.date}`} onClick={() => { setEditingId(row.id); setDate(row.date); setMinutes(String(row.minutes)); setRouteId(row.routeId); }}><Pencil size={14} /></button>
          <button type="button" className={iconButton} title="Remove session" aria-label={`Remove session on ${row.date}`} onClick={() => { if (editingId === row.id) resetSession(); setDeleted(row); change({ ...run, sessions: run.sessions.filter(item => item.id !== row.id) }); }}><Trash2 size={15} /></button>
        </li>)}
      </ul>
      {sorted.length > 5 && <button type="button" className={button} aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Show recent sessions' : `Show all ${sorted.length} sessions`}</button>}
    </details>
  </div>;
}
