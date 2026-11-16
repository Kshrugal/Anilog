import React, { useMemo, useState } from 'react';
import { ChevronDown, Pencil, RotateCcw, Search, X, Clock3, Layers3, Check, BookOpen, Tv } from 'lucide-react';
import { analyze, entryId, exactTime, remainingAnime, statusOf, visualNovel, type LibraryEntry } from '../services/analytics';
import { useFranchiseCatalogue } from './useFranchiseCatalogue';
import { RuntimeAudit } from './RuntimeAudit';

const hours = (minutes: number) => `${(minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
const button = 'px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';
const input = 'bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm min-w-0 text-white';
const cover = (entry: LibraryEntry) => entry.imageUrl || entry.attributes?.posterImage?.small;

export function AnalyticsDashboard({ entries, userId, onSelect, title = 'Your Stats', editableGroups = true }: { entries: LibraryEntry[]; userId: string; onSelect: (entry: LibraryEntry) => void; title?: string; editableGroups?: boolean }) {
  const [tab, setTab] = useState('overview');
  const [grouping, setGrouping] = useState<'franchise' | 'universe'>('universe');
  const { catalogue, state: catalogueState, retry: retryCatalogue } = useFranchiseCatalogue(entries);
  const [format, setFormat] = useState('all');
  const [repeats, setRepeats] = useState(false);
  const [bucket, setBucket] = useState<number | null>(null);
  const [year, setYear] = useState('all');
  const [metric, setMetric] = useState('time');
  const [query, setQuery] = useState('');
  const [daily, setDaily] = useState(45);
  const [scope, setScope] = useState('active');
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const [storageError, setStorageError] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    if (!editableGroups) return {};
    try { const parsed = JSON.parse(localStorage.getItem(`anilog:franchises:${userId}`) || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string')) as Record<string, string> : {}; } catch { return {}; }
  });
  const [editorTrigger, setEditorTrigger] = useState<HTMLButtonElement | null>(null);
  const filtered = useMemo(() => entries.filter(e => format === 'all' || (format === 'vn') === visualNovel(e)), [entries, format]);
  const stats = useMemo(() => analyze(filtered, overrides, repeats, { catalogue, grouping }), [filtered, overrides, repeats, catalogue, grouping]);
  const allStats = useMemo(() => analyze(entries), [entries]);
  const groups = useMemo(() => stats.groups.filter(g => `${g.name} ${g.entries.map(e => e.title).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => metric === 'titles' ? b.entries.length - a.entries.length : metric === 'score' ? average(b.scores) - average(a.scores) : b.minutes - a.minutes), [stats, query, metric]);
  const backlog = remainingAnime(filtered.filter(e => scope === 'all' || ['watching', 'paused'].includes(statusOf(e))), catalogue);
  const timePending = catalogueState.loading && stats.missingAnimeTime > 0;
  const scoreEntries = bucket === null ? [] : stats.buckets[bucket];
  const maxBucket = Math.max(1, ...stats.buckets.map(b => b.length));
  const genreRows = Object.entries(stats.genres).sort((a, b) => b[1].minutes - a[1].minutes).slice(0, 10);
  const saveGroup = (reset = false) => {
    const next = { ...overrides };
    if (reset) delete next[entryId(editing)]; else if (groupDraft.trim()) next[entryId(editing)] = groupDraft.trim().slice(0, 120); else return;
    setOverrides(next); setEditing(null);
    try { localStorage.setItem(`anilog:franchises:${userId}`, JSON.stringify(next)); setStorageError(''); } catch { setStorageError('Grouping changes are temporary because browser storage is unavailable.'); }
  };
  const titleList = (items: LibraryEntry[]) => <div className="divide-y divide-white/10">{items.map(e => <button key={entryId(e)} onClick={() => onSelect(e)} className="w-full flex items-center gap-3 text-left py-3 hover:bg-white/5 rounded-lg px-2 min-w-0">{cover(e) && <img src={cover(e)} alt="" loading="lazy" className="w-9 h-12 rounded object-cover shrink-0" />}<span className="flex-1 min-w-0"><span className="block text-sm break-words">{e.title}</span><span className="text-xs text-gray-400 capitalize">{statusOf(e)} · {visualNovel(e) ? 'Visual novel' : 'Anime'}</span></span><span className="text-sm text-gray-300 shrink-0">{Number.isFinite(Number(e.score)) && Number(e.score) > 0 && Number(e.score) <= 10 ? `${Number(e.score).toLocaleString(undefined, { maximumFractionDigits: 2 })}/10` : 'Unrated'}</span></button>)}</div>;
  return <div className="space-y-6 pb-12">
    <header className="flex flex-wrap justify-between gap-4 items-start sm:items-center"><div className="min-w-0"><h1 className="text-3xl font-bold break-words">{title}</h1><p className="text-gray-400 text-sm mt-1">{entries.length} library listings · {allStats.rated} rated</p></div><label className="flex w-full sm:w-44 min-w-0 flex-col gap-1.5 text-xs text-gray-400"><span>Media</span><select aria-label="Stats media" className={`${input} block w-full h-10 py-0 leading-normal`} value={format} onChange={e => { setFormat(e.target.value); setBucket(null); setYear('all'); }}><option value="all">All media</option><option value="anime">Anime</option><option value="vn">Visual novels</option></select></label></header>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-5 border-y border-white/10 py-6">
      {[['Completed anime', stats.completedAnime, Tv], ['Completed novels', stats.completedVns, BookOpen], ['Known time', timePending ? 'Updating…' : hours(stats.minutes), Clock3], ['Mean score', stats.rated ? stats.mean.toFixed(2) : '—', Layers3]].map(([label, value, Icon]: any) => <div key={label} className="min-w-0"><div className="flex gap-2 text-xs text-gray-400 items-center"><Icon size={14} />{label}</div><div className="text-3xl font-semibold mt-2 break-words tabular-nums">{value}</div>{label === 'Completed anime' && <p className="text-xs text-gray-400 mt-1">Individual library listings</p>}{label === 'Known time' && <button onClick={() => setTab('runtimes')} className="text-xs text-cyan-300 mt-1 text-left">{stats.runtimeKnown}/{stats.runtimeTotal} anime runtimes · Audit</button>}</div>)}
    </div>
    <div className="flex flex-wrap items-center gap-3 justify-between"><nav aria-label="Analytics views" className="flex gap-1 flex-wrap">{[['overview', 'Overview'], ['franchises', 'Franchises'], ['timeline', 'Timeline'], ['lab', 'Time Lab'], ['runtimes', 'Runtimes']].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`${button} ${tab === id ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{label}</button>)}</nav><label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} className="accent-cyan-400" />Include logged anime rewatches</label></div>
    {!timePending && (stats.missingAnimeTime > 0 || stats.missingVnTime > 0) && <p className="text-xs text-amber-200/80">Known time excludes {stats.missingAnimeTime} anime with incomplete time data and {stats.missingVnTime} novels without logged hours. <button className="underline" onClick={() => setTab('runtimes')}>View audit</button></p>}
    {tab === 'runtimes' && <RuntimeAudit entries={filtered} times={stats.times} onSelect={onSelect} />}
    {(tab === 'overview' || tab === 'franchises') && <div className="flex flex-wrap justify-between gap-3 items-center border-b border-white/10 pb-4">
      <div className="flex items-center gap-2 text-xs"><span className="text-gray-400 mr-1">Group by</span>{(['universe', 'franchise'] as const).map(value => <button key={value} aria-pressed={grouping === value} onClick={() => setGrouping(value)} className={`${button} ${grouping === value ? 'bg-cyan-300/15 text-cyan-200' : 'text-gray-400 hover:bg-white/5'}`}>{value === 'universe' ? 'Universe' : 'Series'}</button>)}</div>
      <div className="flex items-center gap-2 text-xs text-gray-400" role="status">{catalogueState.loading ? `Checking catalogue relationships · ${catalogueState.done}/${catalogueState.total}` : `${catalogueState.done}/${catalogueState.total} catalogue identities checked`}<button title="Check catalogue relationships" aria-label="Check catalogue relationships" disabled={catalogueState.loading} onClick={retryCatalogue} className="p-2 hover:text-white disabled:opacity-40"><RotateCcw size={14} /></button></div>
      {catalogueState.error && <p role="alert" className="basis-full text-xs text-amber-300">{catalogueState.error} Reviewed identities and cached relationships remain available.</p>}
    </div>}
    {tab === 'overview' && <div className="space-y-8">
      <section className="grid lg:grid-cols-2 gap-8">
        <div><div className="flex justify-between gap-3 items-baseline"><h2 className="font-semibold">Your rating fingerprint</h2><span className="text-xs text-gray-400">Median {stats.rated ? stats.median.toFixed(2) : '—'} · {stats.rated} rated</span></div><div className="grid grid-cols-10 gap-1.5 h-32 mt-4 items-end" aria-label="Score distribution">{stats.buckets.map((items, i) => <button key={i} aria-label={`Scores above ${i} to ${i + 1}: ${items.length} titles`} aria-pressed={bucket === i} onClick={() => setBucket(bucket === i ? null : i)} className="h-full flex flex-col justify-end items-center gap-1 text-xs min-w-0 group"><span className="text-gray-400 tabular-nums">{items.length}</span><span className={`w-full rounded-t transition-all ${bucket === i ? 'bg-emerald-300' : 'bg-cyan-400/60 group-hover:bg-cyan-300'}`} style={{ height: `${Math.max(3, items.length / maxBucket * 70)}%` }} /><span className="text-gray-400">{i + 1}</span></button>)}</div>{bucket !== null && <div className="mt-4"><div className="flex justify-between text-xs text-gray-400"><span>Scores ({bucket}, {bucket + 1}]</span><button onClick={() => setBucket(null)} aria-label="Clear score filter"><X size={15} /></button></div><div className="max-h-72 overflow-y-auto">{scoreEntries.length ? titleList(scoreEntries) : <p className="text-sm text-gray-500 py-4">No titles in this range.</p>}</div></div>}</div>
        <div><h2 className="font-semibold mb-4">Your library, in motion</h2><div className="space-y-3">{Object.entries(stats.statuses).map(([status, count]) => <div key={status} className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-3 text-xs"><span className="capitalize text-gray-400">{status === 'watching' ? 'In progress' : status}</span><span className="h-2 bg-white/5 rounded overflow-hidden"><span className={`block h-full ${status === 'completed' ? 'bg-emerald-400' : status === 'dropped' ? 'bg-rose-400' : status === 'planned' ? 'bg-amber-300' : 'bg-cyan-400'}`} style={{ width: `${filtered.length ? count / filtered.length * 100 : 0}%` }} /></span><span className="text-right tabular-nums">{count}</span></div>)}</div><p className="text-xs text-gray-500 mt-4">{stats.episodes.toLocaleString()} episodes · {filtered.filter(e => e.favorite).length} favorites · {filtered.length - stats.rated} unrated</p></div>
      </section>
      <section className="border-t border-white/10 pt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Where your time went</h2><button onClick={() => setTab('franchises')} className={`${button} text-cyan-300`}>All franchises</button></div>{[...stats.groups].sort((a, b) => b.minutes - a.minutes).slice(0, 5).map(g => <div key={`${g.name}:${visualNovel(g.entries[0])}`} className="grid grid-cols-[minmax(0,1fr)_4rem] gap-3 py-3"><div className="min-w-0"><span className="text-sm block truncate">{g.name}</span><span className="block h-1 bg-white/5 mt-2"><span className="block h-1 bg-emerald-400/80" style={{ width: `${stats.minutes ? g.minutes / stats.minutes * 100 : 0}%` }} /></span></div><span className="text-sm text-right tabular-nums">{hours(g.minutes)}</span></div>)}</section>
      {genreRows.length > 0 && <section className="border-t border-white/10 pt-6"><h2 className="font-semibold mb-4">Time by genre</h2><div className="grid sm:grid-cols-2 gap-x-10 gap-y-3">{genreRows.map(([name, row]) => <div key={name} className="flex justify-between gap-4 text-sm"><span>{name} <span className="text-xs text-gray-500">{row.count} titles</span></span><span className="text-gray-400">{hours(row.minutes)}</span></div>)}</div><p className="text-xs text-gray-500 mt-3">A title can have several genres, so these totals overlap. {filtered.filter(e => !e.genres?.length).length} listings have no saved genre metadata.</p></section>}
    </div>}
    {tab === 'franchises' && <section className="space-y-4"><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 flex-1 min-w-0"><Search size={16} className="text-gray-400 shrink-0" /><input aria-label="Search franchises" placeholder="Search franchises or titles" className={`${input} w-full`} value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Rank franchises by" value={metric} onChange={e => setMetric(e.target.value)} className={input}><option value="time">Time invested</option><option value="titles">Title count</option><option value="score">Mean score</option></select></div><p className="text-xs text-gray-400">{groups.length} {grouping === 'universe' ? 'universes' : 'series'} · Only saved library entries contribute to time and title totals.{editableGroups ? ' Custom group edits stay in this browser.' : ''}</p>{storageError && <p role="alert" className="text-amber-300 text-sm">{storageError}</p>}
      {groups.map(g => <details key={g.id} className="border-b border-white/10 group">
        <summary className="py-4 flex items-center gap-3 cursor-pointer list-none">
          <ChevronDown size={15} className="shrink-0 group-open:rotate-180 transition-transform" />
          {cover(g.entries[0]) && <img src={cover(g.entries[0])} alt="" loading="lazy" className="w-10 h-14 rounded object-cover shrink-0" />}
          <div className="flex-1 min-w-0"><span className="text-sm font-medium break-words">{g.name}</span><p className="text-xs text-gray-500 mt-1">{g.entries.length} listings · {g.completed} completed · {g.scores.length ? `${average(g.scores).toFixed(2)} mean` : 'Unrated'}</p>{g.franchises.length > 1 && <p className="text-xs text-cyan-300/70 mt-1">{g.franchises.length} connected series</p>}</div>
          <span className="text-sm shrink-0 text-right tabular-nums">{g.minutes || !g.unknownTimeCount ? hours(g.minutes) : 'Unlogged'}{g.unknownTimeCount > 0 && <span className="block text-[10px] text-amber-200/70 mt-1">{g.unknownTimeCount} missing time</span>}</span>
        </summary>
        <div className="pl-2 sm:pl-7 pb-4">
          {g.franchises.length > 1 && <p className="text-xs text-gray-400 mb-3">{g.franchises.join(' · ')}</p>}
          {g.entries.map(e => { const time = stats.times[entryId(e)]; return <div key={entryId(e)} className="flex gap-2 items-center border-t border-white/5">
            <div className="flex-1 min-w-0">{titleList([e])}</div>
            <span title={time.basis} className={`text-xs whitespace-nowrap tabular-nums ${time.unknown ? 'text-amber-200/80' : 'text-gray-300'}`}>{time.unknown ? visualNovel(e) ? 'Not logged' : 'Unknown' : exactTime(time.minutes)}</span>
            {editableGroups && <button className="p-2 text-gray-400 hover:text-white shrink-0" title="Edit franchise group" aria-label={`Edit group for ${e.title}`} onClick={event => { setEditorTrigger(event.currentTarget); setEditing(e); setGroupDraft(overrides[entryId(e)] || g.name); }}><Pencil size={15} /></button>}
          </div>; })}
          <details className="mt-3 text-xs text-gray-400"><summary className="cursor-pointer py-2">Grouping evidence</summary><div className="divide-y divide-white/5">{g.entries.map(e => { const membership = stats.memberships[entryId(e)]; return <div key={entryId(e)} className="py-3 space-y-1"><p className="text-gray-200">{e.title}</p><p>{membership.basis}{membership.creators.length ? ` · ${membership.creators.join(', ')}` : ''}</p>{membership.source && <a href={membership.source} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Source</a>}</div>; })}</div></details>
        </div>
      </details>)}{!groups.length && <p className="text-gray-400 py-8">No matching franchises.</p>}
    </section>}
    {tab === 'timeline' && <section><div className="flex justify-between items-center gap-3 mb-5"><h2 className="font-semibold">Your completed chapters</h2><select aria-label="Completion year" value={year} onChange={e => setYear(e.target.value)} className={input}><option value="all">All years</option>{Object.keys(stats.years).sort().reverse().map(y => <option key={y}>{y}</option>)}</select></div><div className="flex flex-wrap gap-3 mb-6">{Object.entries(stats.years).sort((a, b) => b[0].localeCompare(a[0])).map(([y, row]) => <button key={y} onClick={() => setYear(year === y ? 'all' : y)} aria-pressed={year === y} className={`p-4 border-l-2 text-left min-w-28 ${year === y ? 'border-cyan-300 bg-white/5' : 'border-white/15 hover:bg-white/5'}`}><span className="text-xs text-gray-400">{y}</span><strong className="block text-2xl mt-1">{row.entries.length}</strong><span className="text-xs text-gray-500">{hours(row.minutes)} invested</span></button>)}</div><p className="text-xs text-gray-400 mb-4">Completion dates, not import dates. {stats.undatedCompleted} completed listings have no valid finish date. Time is total investment in those titles, not necessarily hours spent that year.</p>{titleList(Object.entries(stats.years).filter(([y]) => year === 'all' || y === year).flatMap(([, row]) => row.entries).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))))}{!Object.keys(stats.years).length && <p className="text-gray-500 py-8">No completion dates recorded yet.</p>}</section>}
    {tab === 'lab' && <section className="space-y-6">
      <h2 className="font-semibold">Make room for the next story</h2>
      {format === 'vn' ? <p role="status" className="text-sm text-gray-400">Visual-novel completion time cannot be predicted from reading percentage or logged hours. Select Anime or All media to estimate an anime queue.</p> : <>
        <div className="grid md:grid-cols-2 gap-8"><div className="space-y-5">
          <label className="block text-sm">Queue<select aria-label="Time Lab queue" className={`${input} block w-full mt-2`} value={scope} onChange={e => setScope(e.target.value)}><option value="active">Watching + paused anime</option><option value="all">Watching + paused + planned anime</option></select></label>
          <label className="block text-sm">Daily budget <strong className="float-right tabular-nums text-cyan-300">{daily} min</strong><input aria-label="Daily minutes" type="range" min="15" max="180" step="15" value={daily} onChange={e => setDaily(Number(e.target.value))} className="block w-full mt-4 accent-cyan-300" /></label>
          <div className="flex justify-between text-xs text-gray-500"><span>One episode</span><span>A longer evening</span></div>
        </div><div className="border-l-2 border-emerald-400/60 pl-6">
          <p className="text-sm text-gray-400">Remaining known anime queue</p>
          {backlog.minutes > 0 ? <><p className="text-4xl font-semibold my-3">{hours(backlog.minutes)}</p><p className="text-gray-300">About <strong className="text-emerald-300">{Math.ceil(backlog.minutes / daily).toLocaleString()} days</strong> at this pace</p></> : <p role="status" className="my-3 text-gray-300">{backlog.unknown ? 'Remaining time is unavailable for this queue.' : 'No known episodes remaining in this queue.'}</p>}
          <p className="text-xs text-gray-500 mt-4">{backlog.unknown} anime have unknown runtimes or episode totals and are excluded. Uses catalogue runtimes, with saved metadata only when catalogue duration is unavailable. Future episodes, new additions, and visual-novel completion times are not predicted.</p>
        </div></div>
        {stats.minutes > 0 && <div className="border-t border-white/10 pt-5"><h3 className="text-sm font-medium">Your investment in perspective</h3><p className="text-gray-400 text-sm mt-2">{hours(stats.minutes)} is {Math.floor(stats.minutes / 480).toLocaleString()} eight-hour days of stories. At {daily} minutes a day, that is {Math.ceil(stats.minutes / daily).toLocaleString()} days of your chosen pace.</p></div>}
      </>}
    </section>}
    {!filtered.length && <p className="py-4 text-sm text-gray-400">No listings for this media filter yet.</p>}
    <details className="border-t border-white/10 pt-4 text-xs text-gray-400"><summary className="cursor-pointer py-2">Counting & estimates</summary><div className="space-y-3 mt-3 leading-relaxed max-w-3xl">
      <p>Completed anime counts each saved listing separately, including seasons, films and specials. Visual novels are counted separately. Franchise grouping never changes these counts.</p>
      <p>Grouping uses AniList source, adaptation, sequel and spin-off relationships, official VNDB relations, exact provider mappings, and reviewed franchise aliases. Universe view includes larger umbrellas such as TYPE-MOON; Series view separates Fate, Tsukihime and its other branches. Anime and visual novels can belong to the same group. External catalogue entries are relationship context only and never add untracked titles or time.</p>
      <p>Original creators and VN developers provide supporting evidence. A shared director, animation studio, composer, character cameo or generic OTHER relationship never automatically merges franchises. Unconfirmed title fallbacks remain explicitly identified under Grouping evidence; catalogue coverage is not a guarantee of perfect taxonomy. {editableGroups ? 'Custom grouping overrides stay in this browser and do not alter the saved library.' : 'This public view does not apply a visitor’s personal grouping overrides.'}</p>
      <p>The previous official title-stripping counter would report {stats.legacyCompletedGroups} groups rather than {stats.completedAnime} completed anime listings. That legacy number is retained only for comparison, not used by the new franchise engine.</p>
      <p>Anime time uses each listing’s catalogue runtime and episode count, with saved duration metadata only when the catalogue is missing a runtime. Completed finished listings count their full episode total; in-progress listings count recorded episodes only. Airing shows never add future unaired episodes. Series use the catalogue’s general per-episode duration, so unusual-length episodes, skipped credits, and unlogged rewatches can differ from actual viewing time. There is no universal 24-minute assumption. {repeats ? 'Logged repeat counts add full known finished anime episode totals.' : 'Rewatches are excluded unless enabled above.'} The Runtime audit shows the calculation and source for each listing.</p>
      <p>Visual-novel time uses logged playtime only, never reading percentage or guessed length. {stats.missingVnTime} non-planned novels have no logged hours. Ratings exclude zero, invalid and out-of-range values; decimal scores stay exact. Histogram bins are (0,1], (1,2], and so on.</p>
    </div></details>
    {editing && <FranchiseEditor returnFocus={editorTrigger} onDismiss={() => setEditing(null)}>
      <form onSubmit={e => { e.preventDefault(); saveGroup(); }} className="p-5 space-y-4">
        <div className="flex justify-between gap-3"><h2 className="font-semibold">Franchise group</h2><button type="button" onClick={() => setEditing(null)} aria-label="Close group editor"><X size={18} /></button></div>
        <p className="text-sm text-gray-400 break-words">{editing.title}</p>
        <input autoFocus required maxLength={120} aria-label="Franchise name" list="franchise-names" value={groupDraft} onChange={e => setGroupDraft(e.target.value)} className={`${input} w-full`} />
        <datalist id="franchise-names">{[...new Set(stats.groups.map(g => g.name))].map(name => <option key={name} value={name} />)}</datalist>
        <div className="flex justify-between gap-3"><button type="button" onClick={() => saveGroup(true)} className={`${button} flex gap-2 items-center text-gray-400`}><RotateCcw size={15} />Reset</button><button type="submit" className={`${button} bg-cyan-300 text-black flex gap-2 items-center`}><Check size={15} />Save group</button></div>
      </form>
    </FranchiseEditor>}
  </div>;
}
function FranchiseEditor({ children, returnFocus, onDismiss }: { children: React.ReactNode; returnFocus: HTMLElement | null; onDismiss: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const target = returnFocus?.isConnected ? returnFocus : previousFocus instanceof HTMLElement && previousFocus.isConnected ? previousFocus : document.querySelector<HTMLInputElement>('input[aria-label="Search franchises"]');
      target?.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return <dialog ref={dialogRef} aria-label="Edit franchise group" className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-lg border border-white/15 bg-[#101014] p-0 text-white backdrop:bg-black/80" onCancel={event => { event.preventDefault(); onDismiss(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss();
  }}>{children}</dialog>;
}
function average(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
