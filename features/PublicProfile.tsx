import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, UserPlus, Check, ArrowUpRight, Tv, BookOpen, BarChart3 } from 'lucide-react';
import { AnimeCard } from '../App';
import { profileEntry, profileIsVn, profileLibrary, profileProgress } from '../services/profile';
import { IdentityImage } from './ProfileIdentityVisual';

export function PublicProfileHeader({ name, entries, favorites, stats, privateLibrary, loading, tab, onTab, onBack, onRefresh, canFollow, following, followBusy, onFollow, canCompare, identity = null }) {
  const covers = [...(identity ? [...identity.showcases.anime, ...identity.showcases.vn] : []), ...(privateLibrary ? [] : [...favorites.filter(Boolean), ...entries])].map(e => e.imageUrl || e.image || e.attributes?.posterImage?.large).filter((url, index, all) => url && all.indexOf(url) === index).slice(0, 6);
  return <header className="border-b border-white/15">
    <div className="relative min-h-60 sm:min-h-72 overflow-hidden flex items-end">
      {identity?.bannerMode === 'image' && identity.banner.url ? <IdentityImage image={identity.banner} className="absolute inset-0" /> : <div className="absolute inset-0 flex" aria-hidden="true">{covers.map((url, index) => <img key={url} src={url} alt="" className={`w-0 flex-1 h-full min-w-0 min-h-0 object-cover ${index > 2 ? 'hidden sm:block' : ''}`} referrerPolicy="no-referrer" />)}</div>}
      <div className="absolute inset-0 bg-gradient-to-t from-[#08090f] via-black/60 to-black/35" />
      <button onClick={onBack} aria-label="Back to community" title="Back to community" className="absolute top-4 left-4 p-2.5 rounded-full bg-black/50 text-white border border-white/15"><ArrowLeft size={18} /></button>
      <button onClick={onRefresh} disabled={loading} aria-label="Refresh profile" title="Refresh profile" className="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 text-white border border-white/15 disabled:opacity-40"><RotateCcw size={17} /></button>
      <div className="relative w-full p-5 sm:p-7 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-full flex items-center gap-4"><div className="h-14 w-14 sm:h-20 sm:w-20 shrink-0 overflow-hidden border border-white/25 bg-black/40 backdrop-blur-xl rounded-lg grid place-items-center text-2xl font-bold text-cyan-200" aria-hidden="true">{identity?.avatar.url ? <IdentityImage image={identity.avatar} className="w-full h-full" /> : String(name || '?').slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="text-xs text-cyan-200 mb-1">AniLog member</p><h1 className="text-3xl sm:text-4xl font-bold break-words text-white">{name}</h1><p className="text-xs text-gray-300 mt-2">{privateLibrary ? 'Private library' : loading ? 'Loading library…' : `${entries.length} titles · ${stats.completed} completed · ${stats.meanScore} mean score`}</p></div></div>
        {canFollow && <button onClick={onFollow} disabled={followBusy} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold disabled:opacity-50 ${following ? 'border-white/25 bg-black/30 text-white' : 'border-cyan-300/40 bg-cyan-300 text-black'}`}>{following ? <Check size={16} /> : <UserPlus size={16} />}{following ? 'Following' : 'Follow'}</button>}
      </div>
    </div>
    <nav aria-label={`${name} profile`} className="flex overflow-x-auto gap-1 px-1 sm:px-4 bg-black/15">
      {[['overview', 'Overview'], ['library', 'Library'], ['stats', 'Statistics'], ...(canCompare ? [['compare', 'Compare']] : [])].map(([value, label]) => <button key={value} onClick={() => onTab(value)} aria-current={tab === value ? 'page' : undefined} className={`shrink-0 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${tab === value ? 'border-cyan-300 text-cyan-200' : 'border-transparent text-gray-400 hover:text-white'}`}>{label}</button>)}
    </nav>
  </header>;
}

export function PublicProfileOverview({ entries, stats, onSelect, onLibrary, onStats }) {
  const [media, setMedia] = useState('all');
  const active = profileLibrary(entries, media, 'watching').items;
  const totals = profileLibrary(entries).counts;
  const animeCount = entries.filter(e => !profileIsVn(e)).length;
  const vnCount = entries.length - animeCount;
  return <div className="grid lg:grid-cols-[minmax(0,1fr)_16rem] gap-8 lg:gap-10">
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="text-xl font-semibold">In progress</h2><button onClick={() => onLibrary('all', 'watching')} className="flex items-center gap-1 text-xs text-cyan-300 py-2">View all<ArrowUpRight size={14} /></button></div>
      <div className="flex gap-1 border-b border-white/10 mb-5">{[['all', 'All'], ['anime', 'Watching'], ['vn', 'Reading']].map(([value, label]) => <button key={value} aria-pressed={media === value} onClick={() => setMedia(value)} className={`px-3 py-2.5 text-xs font-medium border-b-2 ${media === value ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-white'}`}>{label} <span className="ml-1 text-gray-500">{profileLibrary(entries, value, 'watching').items.length}</span></button>)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">{active.slice(0, 8).map(entry => <div key={entry.id} className="min-w-0"><AnimeCard anime={entry} onCardClick={() => onSelect(entry)} viewMode="grid" /><p className="text-xs text-cyan-200/70 mt-2">{profileIsVn(entry) ? 'Reading' : 'Watching'}</p>{(profileIsVn(entry) ? !(Number(entry.watchedEpisodes) > 0) : !Number(entry.totalEpisodes || entry.episodeCount)) && <p className="text-xs text-gray-500 mt-1">{profileProgress(entry)}</p>}</div>)}</div>
      {!active.length && <div className="py-12 border-y border-white/5 text-gray-500 text-sm">No {media === 'vn' ? 'novels being read' : media === 'anime' ? 'anime being watched' : 'titles in progress'}.</div>}
    </section>
    <aside className="border-t lg:border-t-0 lg:border-l border-white/10 pt-6 lg:pt-0 lg:pl-6 min-w-0">
      <div className="flex justify-between items-center mb-4"><h2 className="font-semibold">Library</h2><button onClick={() => onLibrary('all', 'all')} title="Open entire library" aria-label="Open entire library" className="p-2 text-cyan-300"><ArrowUpRight size={16} /></button></div>
      <div className="flex gap-5 mb-5 text-sm"><button aria-label={`${animeCount} anime in library`} title="Anime library" onClick={() => onLibrary('anime', 'all')} className="flex items-center gap-2 text-gray-300"><Tv size={15} />{animeCount}</button><button aria-label={`${vnCount} visual novels in library`} title="Visual novel library" onClick={() => onLibrary('vn', 'all')} className="flex items-center gap-2 text-gray-300"><BookOpen size={15} />{vnCount}</button></div>
      <div className="divide-y divide-white/5">{[['watching', 'Watching / reading', 'bg-cyan-300'], ['completed', 'Completed', 'bg-emerald-300'], ['planned', 'Planned', 'bg-amber-300'], ['paused', 'Paused', 'bg-violet-300'], ['dropped', 'Dropped', 'bg-rose-300']].map(([value, label, color]) => <button key={value} onClick={() => onLibrary('all', value)} className="flex items-center gap-3 py-3 w-full text-left text-sm hover:text-white text-gray-400"><span className={`h-1.5 w-1.5 rounded-full shrink-0 ${color}`} /><span className="flex-1">{label}</span><span className="text-white tabular-nums">{totals[value]}</span></button>)}</div>
      <button onClick={onStats} className="border-t border-white/10 mt-5 pt-5 w-full text-left group"><span className="flex justify-between items-center text-sm font-semibold text-white"><span className="flex items-center gap-2"><BarChart3 size={16} />Statistics</span><ArrowUpRight size={15} className="text-cyan-300" /></span><span className="block mt-3 text-2xl text-cyan-200 tabular-nums">{stats.timePending ? 'Updating…' : stats.hours.toLocaleString()}<span className="text-xs text-gray-500 ml-2">known hours</span></span><span className="block text-xs text-gray-500 mt-2">{stats.eps.toLocaleString()} episodes · {stats.timePending ? '…' : stats.daysConsumed} days</span></button>
    </aside>
  </div>;
}

export function PublicProfileFavorites({ favorites, onSelect }) {
  const entries = favorites.filter(Boolean).map(profileEntry);
  if (!entries.length) return null;
  return <section className="border-t border-white/10 pt-7"><h2 className="text-xl font-semibold mb-5">Hall of Fame</h2><div className="flex gap-4 overflow-x-auto pb-4 snap-x">{entries.map((entry, index) => <div key={`${entry.kitsuId}:${index}`} className="w-32 sm:w-40 shrink-0 snap-start"><AnimeCard anime={entry} onCardClick={() => onSelect(entry)} viewMode="grid" /></div>)}</div></section>;
}
