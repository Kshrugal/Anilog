import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, UserPlus, Check, ArrowUpRight, Tv, BookOpen, BarChart3, Eye, ArrowLeft as ReturnIcon, Pencil, Settings, LogOut } from 'lucide-react';
import { AnimeCard } from '../App';
import { profileEntry, profileIsVn, profileLibrary, profileProgress } from '../services/profile';
import { IdentityImage } from './ProfileIdentityVisual';
import { ProfileBio } from './ProfileBio';
import './public-profile.css';

export function ProfileOwnerTools({ preview, busy, onPreview, onCustomize, onAccount, onLogout }: { preview: boolean; busy: boolean; onPreview: () => void; onCustomize: () => void; onAccount: () => void; onLogout?: () => void }) {
  return <div className={`profile-owner-tools ${preview ? 'is-visiting' : ''}`}>
    {preview ? <><span className="profile-visitor-label"><Eye size={15} />Viewing as a visitor</span><button type="button" className="profile-exit-preview" onClick={onPreview}><ReturnIcon size={15} />Exit preview</button></> : <>
      <button type="button" className="profile-tool-icon" title="View as visitor" aria-label="View as visitor" onClick={onPreview}><Eye size={17} /></button>
      <button type="button" className="profile-customize" disabled={busy} onClick={onCustomize}><Pencil size={14} />Customize profile</button>
      <button type="button" className="profile-tool-icon" aria-label="Manage account" title="Manage account" onClick={onAccount}><Settings size={17} /></button>
      {onLogout && <button type="button" className="profile-tool-icon" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={17} /></button>}
    </>}
  </div>;
}

export function ProfileIntroduction({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = React.useId();
  const collapsible = text.length > 320 || text.split('\n').length > 4;
  return <div className={`public-profile-intro ${collapsible && !expanded ? 'is-collapsed' : ''}`}>
    <div id={id} className="profile-intro-text"><ProfileBio text={text} /></div>
    {collapsible && <button type="button" className="profile-intro-expand" aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read more'}</button>}
  </div>;
}

export function PublicProfileHeader({ name, entries, favorites, stats, privateLibrary, loading, tab, onTab, onBack, onRefresh, canFollow, following, followBusy, onFollow, canCompare, identity = null, showTabs = true }) {
  const covers = [...(identity ? [...identity.showcases.anime, ...identity.showcases.vn] : []), ...(privateLibrary ? [] : [...favorites.filter(Boolean), ...entries])].map(e => e.imageUrl || e.image || e.attributes?.posterImage?.large).filter((url, index, all) => url && all.indexOf(url) === index).slice(0, 6);
  return <header className="public-profile-header">
    <div className="public-profile-cover">
      {identity?.bannerMode === 'image' && identity.banner.url ? <IdentityImage image={identity.banner} className="absolute inset-0" /> : <div className="public-profile-cover-art" aria-hidden="true">{covers.map((url, index) => <img key={url} src={url} alt="" className={index > 2 ? 'hidden sm:block' : ''} referrerPolicy="no-referrer" />)}</div>}
      {onBack && <button type="button" onClick={onBack} aria-label="Back to community" title="Back to community" className="profile-cover-back p-2.5 rounded-full bg-black/50 text-white border border-white/15"><ArrowLeft size={18} /></button>}
      {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh profile" title="Refresh profile" className="profile-cover-refresh p-2.5 rounded-full bg-black/50 text-white border border-white/15 disabled:opacity-40"><RotateCcw size={17} /></button>}
    </div>
    <div className="public-profile-summary">
      <div className="public-profile-avatar" aria-hidden="true">{identity?.avatar.url ? <IdentityImage image={identity.avatar} className="w-full h-full" /> : String(name || '?').slice(0, 1).toUpperCase()}</div>
      <div className="public-profile-identity"><h1>{name}</h1>
        <p className="public-profile-metrics">{privateLibrary ? 'Private library' : loading ? 'Loading library...' : `${entries.length} titles · ${stats.completed} completed · ${stats.meanScore} mean score`}</p>
        {identity?.modules[0] === 'bio' && identity.bio && <ProfileIntroduction key={name} text={identity.bio} />}
      </div>
      {canFollow && <button type="button" onClick={onFollow} disabled={followBusy} className={`public-profile-follow flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold disabled:opacity-50 ${following ? 'border-white/25 bg-black/30 text-white' : 'border-cyan-300/40 bg-cyan-300 text-black'}`}>{following ? <Check size={16} /> : <UserPlus size={16} />}{following ? 'Following' : 'Follow'}</button>}
    </div>
    {showTabs && <nav aria-label={`${name} profile`} className="flex overflow-x-auto gap-1 px-1 sm:px-4">
      {[['overview', 'Overview'], ['library', 'Library'], ['stats', 'Statistics'], ...(canCompare ? [['compare', 'Compare']] : [])].map(([value, label]) => <button type="button" key={value} onClick={() => onTab(value)} aria-current={tab === value ? 'page' : undefined} className={`shrink-0 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${tab === value ? 'border-cyan-300 text-cyan-200' : 'border-transparent text-gray-400 hover:text-white'}`}>{label}</button>)}
    </nav>}
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
