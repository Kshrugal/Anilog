import React from 'react';
import { ACCENTS, type ProfileIdentity, type ProfileImage } from '../services/profile-identity';

export function IdentityImage({ image, className = '' }: { image: ProfileImage; className?: string }) {
  const url = import.meta.env.DEV && import.meta.env.VITE_LOCAL_FIREBASE === 'true' && image.url.startsWith('https://firebasestorage.googleapis.com/v0/b/demo-anilog.appspot.com/') ? image.url.replace('https://firebasestorage.googleapis.com', 'http://127.0.0.1:9199') : image.url;
  return <div className={`overflow-hidden ${className}`}><img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: `${image.x}% ${image.y}%`, transform: `scale(${image.zoom})`, transformOrigin: `${image.x}% ${image.y}%` }} /></div>;
}
export function ProfileIdentityVisual({ identity, name, covers = [], mobile = false }: { identity: ProfileIdentity; name: string; covers?: string[]; mobile?: boolean }) {
  return <div className={`relative overflow-hidden bg-[#11141c] ${mobile ? 'h-60' : 'h-72'}`} style={{ color: ACCENTS[identity.accent] }}>
    {identity.bannerMode === 'image' && identity.banner.url ? <IdentityImage image={identity.banner} className="absolute inset-0" /> : <div className="absolute inset-0 flex">{covers.slice(0, mobile ? 3 : 6).map((src, i) => <img key={i} src={src} alt="" className="w-0 min-w-0 flex-1 object-cover" referrerPolicy="no-referrer" />)}</div>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#08090f] via-black/60 to-black/35" />
    <div className={`absolute flex gap-4 items-center ${mobile ? 'bottom-5 left-5 right-5' : 'bottom-7 left-7 right-7'}`}><div className={`shrink-0 rounded-lg border border-white/25 overflow-hidden bg-black/40 backdrop-blur-xl ${mobile ? 'w-14 h-14' : 'w-20 h-20'}`}>{identity.avatar.url ? <IdentityImage image={identity.avatar} className="w-full h-full" /> : <span className="grid place-items-center h-full text-2xl font-bold">{name.slice(0, 1).toUpperCase()}</span>}</div><div className="min-w-0"><p className="text-xs mb-1">AniLog member</p><h2 className={`font-bold break-words text-white ${mobile ? 'text-3xl' : 'text-4xl'}`}>{name}</h2></div></div>
  </div>;
}
