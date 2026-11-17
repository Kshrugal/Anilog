import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Check, ChevronDown, Loader2, Tv } from 'lucide-react';
import { profileIsVn, profileProgress } from '../services/profile';
import { progressCommand } from '../services/home-library';
import './home.css';

export function HomeResume({ entries, selected, onSelect, onOpen, onIncrement, pending, theme }) {
  if (!selected) return null;
  const vn = profileIsVn(selected);
  const total = vn ? 100 : Math.max(0, Number(selected.totalEpisodes) || 0);
  const progress = Math.max(0, Number(selected.watchedEpisodes) || 0);
  const percent = total ? Math.min(100, progress / total * 100) : 0;
  return <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} aria-label="Resume your library" className="relative w-full h-64 sm:h-56 rounded-3xl overflow-hidden shadow-2xl group cursor-pointer border border-white/10">
    <img src={selected.imageUrl} className="w-full h-full object-cover opacity-60 transition-transform duration-[2s] group-hover:scale-105" alt="" referrerPolicy="no-referrer" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
    <button type="button" className="home-resume-open" aria-label={`Open ${selected.title}`} title={`Open ${selected.title}`} onClick={() => onOpen(selected)} />
    {entries.length > 1 && <label className="home-resume-switcher"><select aria-label="Resume title" value={String(selected.id)} onChange={event => onSelect(event.target.value)}>{entries.map((entry, index) => <option value={String(entry.id)} key={entry.id}>{index + 1}/{entries.length} · {entry.title}</option>)}</select><ChevronDown size={14} /></label>}
    <div className="home-resume-content">
      <p className={`text-xs font-bold uppercase mb-2 flex items-center gap-2 ${theme.accentText}`}>{vn ? <BookOpen size={14} /> : <Tv size={14} />}{vn ? 'Continue Reading' : 'Continue Watching'}</p>
      <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 line-clamp-2 sm:line-clamp-1">{selected.title}</h3>
      <div className="home-resume-footer"><div className="home-resume-progress"><span>{profileProgress(selected)}</span><div className="home-resume-track" role="progressbar" aria-label={`${selected.title} progress`} aria-valuemin={0} aria-valuemax={total || undefined} aria-valuenow={total ? Math.min(total, progress) : undefined} aria-valuetext={profileProgress(selected)}><motion.div animate={{ width: `${percent}%` }} className={`h-full ${theme.progressbar}`} /></div></div>
        <button type="button" className="home-log-progress" disabled={pending} aria-label={`${progressCommand(selected)} for ${selected.title}`} onClick={() => onIncrement(selected)}>{pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{pending ? 'Saving...' : progressCommand(selected)}</button>
      </div>
    </div>
  </motion.section>;
}
