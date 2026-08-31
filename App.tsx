import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
  createContext,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { getAniListMedia } from "./services/anilist";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
  addDoc,
  deleteField,
} from "firebase/firestore";
import { setLogLevel } from "firebase/firestore";
import { 
    motion, 
    AnimatePresence, 
    useSpring, 
    useTransform, 
    useMotionValue, 
    useMotionTemplate, 
} from "framer-motion";
import { 
  Search as SearchIcon, 
  Plus as PlusIcon, 
  User as ProfileIcon, 
  Home as HomeIcon, 
  BarChart2 as StatsIcon, 
  LogOut as LogoutIcon, 
  Star as StarIcon,
  Users as SocialIcon,
  Dices as DiceIcon,
  Heart as HeartIcon,
  FileText as DocumentTextIcon,
  Compass as CompassIcon,
} from 'lucide-react';
// Removed AI and GenreGalaxy imports as requested

// --- Firebase Configuration ---
const hardcodedConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || hardcodedConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || hardcodedConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || hardcodedConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || hardcodedConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || hardcodedConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || hardcodedConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || hardcodedConfig.measurementId,
};

export const appId = import.meta.env.VITE_FIREBASE_APP_ID || hardcodedConfig.appId;

export const APP_NAME = "AniLog";
const CREATOR_NAME = "KshrugalJain";
const IS_PREVIEW = import.meta.env.VITE_DEPLOY_ENV === 'preview';

const PAGE_PATHS = {
  home: '/',
  search: '/search',
  discovery: '/discover',
  social: '/social',
  stats: '/stats',
  profile: '/profile',
};

const PAGE_META = {
  home: ['AniLog — Your Anime & Visual Novel Tracker', 'Track your anime and visual novel progress, ratings, notes, and favorites.'],
  search: ['Search Anime & Visual Novels — AniLog', 'Search AniList and VNDB to find your next anime or visual novel.'],
  discovery: ['Discover Anime — AniLog', 'Explore trending, airing, upcoming, and top-rated anime powered by AniList.'],
  social: ['Anime Activity & Friends — AniLog', 'Explore community activity and public anime profiles on AniLog.'],
  stats: ['Your Anime Stats — AniLog', 'Explore your watch time, ratings, genres, milestones, and anime history.'],
  profile: ['Your Profile — AniLog', 'Manage your AniLog profile, appearance, data, and hall of fame.'],
  user_profile: ['Community Profile — AniLog', 'View an AniLog community member’s public anime profile and library.'],
};

const getPageFromPath = (pathname) => {
  if (pathname.startsWith('/users/')) return 'user_profile';
  return Object.entries(PAGE_PATHS).find(([, path]) => path === pathname)?.[0] || 'home';
};

// --- Initialize Firebase ---
let app;
export let auth;
let db;
let firebaseInitError = null;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setLogLevel("silent"); 
} catch (error) {
  console.error("Error initializing Firebase:", error);
  firebaseInitError = error;
}

// --- Kitsu API Configuration ---
export const KITSU_API_URL = "https://kitsu.io/api/edge";
export const AVG_EPISODE_MINUTES = 24;

// --- Unified Media Details Loader (Supports Kitsu and VNDB) ---
export const fetchMediaDetails = async (id) => {
  const strId = String(id);
  if (strId.startsWith('anilist:')) {
    return getAniListMedia(strId);
  } else if (strId.startsWith('v')) {
    const response = await fetch('https://api.vndb.org/kana/vn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filters: ["id", "=", strId],
            fields: 'id, title, alttitle, image.url, rating, length, description'
        })
    });
    if (!response.ok) throw new Error("VNDB details fetch failed");
    const resData = await response.json();
    if (resData.results && resData.results.length > 0) {
        const vn = resData.results[0];
        return {
            id: vn.id,
            mediaType: 'vn',
            attributes: {
                canonicalTitle: vn.title || vn.alttitle || 'Unknown',
                posterImage: {
                    original: vn.image?.url || '',
                    large: vn.image?.url || '',
                    medium: vn.image?.url || '',
                    small: vn.image?.url || ''
                },
                showType: 'Visual Novel',
                episodeCount: vn.length ? `${vn.length}h` : 'N/A',
                averageRating: vn.rating ? (vn.rating / 10).toFixed(1) : null,
                synopsis: vn.description || ''
            }
        };
    } else {
        throw new Error("No VN found");
    }
  } else {
    const response = await fetch(`${KITSU_API_URL}/anime/${id}`);
    if (!response.ok) throw new Error("Failed to fetch Kitsu details");
    const resData = await response.json();
    return resData.data;
  }
};

// --- THEME CONFIGURATION ---
export const THEMES = {
  neon: {
    id: 'neon',
    name: 'Neon',
    accentText: 'text-blue-400',
    accentTextDark: 'text-blue-600',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-500',
    accentBorder: 'border-blue-500/30',
    gradient: 'from-blue-500 via-purple-500 to-cyan-500',
    glow: 'shadow-blue-500/50',
    progressbar: 'bg-blue-500',
    subtle: 'bg-blue-900/20 text-blue-200',
    button: 'bg-blue-600 hover:bg-blue-500',
    scrollbarThumb: '#3b82f6',
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic',
    accentText: 'text-lime-400',
    accentTextDark: 'text-lime-600',
    accentBg: 'bg-lime-600',
    accentBgHover: 'hover:bg-lime-500',
    accentBorder: 'border-lime-500/30',
    gradient: 'from-lime-400 via-green-500 to-emerald-500',
    glow: 'shadow-lime-500/50',
    progressbar: 'bg-lime-500',
    subtle: 'bg-lime-900/20 text-lime-200',
    button: 'bg-lime-600 hover:bg-lime-500',
    scrollbarThumb: '#84cc16',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    accentText: 'text-rose-400',
    accentTextDark: 'text-rose-600',
    accentBg: 'bg-rose-600',
    accentBgHover: 'hover:bg-rose-500',
    accentBorder: 'border-rose-500/30',
    gradient: 'from-orange-400 via-pink-500 to-rose-500',
    glow: 'shadow-rose-500/50',
    progressbar: 'bg-rose-500',
    subtle: 'bg-rose-900/20 text-rose-200',
    button: 'bg-rose-600 hover:bg-rose-500',
    scrollbarThumb: '#e11d48',
  },
  indigo: {
    id: 'indigo',
    name: 'Indigo',
    accentText: 'text-indigo-400',
    accentTextDark: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
    accentBgHover: 'hover:bg-indigo-500',
    accentBorder: 'border-indigo-500/30',
    gradient: 'from-indigo-900 via-blue-900 to-violet-600',
    glow: 'shadow-indigo-500/50',
    progressbar: 'bg-indigo-500',
    subtle: 'bg-indigo-900/40 text-indigo-200',
    button: 'bg-indigo-600 hover:bg-indigo-500',
    scrollbarThumb: '#4f46e5',
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    accentText: 'text-orange-500',
    accentTextDark: 'text-orange-700',
    accentBg: 'bg-orange-600',
    accentBgHover: 'hover:bg-orange-500',
    accentBorder: 'border-orange-500/30',
    gradient: 'from-orange-600 via-red-800 to-orange-500',
    glow: 'shadow-orange-500/50',
    progressbar: 'bg-orange-500',
    subtle: 'bg-orange-900/20 text-orange-200',
    button: 'bg-orange-600 hover:bg-orange-500',
    scrollbarThumb: '#f97316',
  },
  monochrome: {
    id: 'monochrome',
    name: 'Mono',
    accentText: 'text-gray-200',
    accentTextDark: 'text-white',
    accentBg: 'bg-gray-100',
    accentBgHover: 'hover:bg-gray-200',
    accentBorder: 'border-white/30',
    gradient: 'from-black via-gray-800 to-white',
    glow: 'shadow-white/20',
    progressbar: 'bg-white',
    subtle: 'bg-white/10 text-gray-300',
    button: 'bg-white text-black hover:bg-gray-200',
    scrollbarThumb: '#ffffff',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    accentText: 'text-emerald-400',
    accentTextDark: 'text-emerald-600',
    accentBg: 'bg-emerald-600',
    accentBgHover: 'hover:bg-emerald-500',
    accentBorder: 'border-emerald-500/30',
    gradient: 'from-green-600 via-teal-900 to-emerald-800',
    glow: 'shadow-emerald-500/50',
    progressbar: 'bg-emerald-500',
    subtle: 'bg-emerald-900/20 text-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-500',
    scrollbarThumb: '#10b981',
  }
};

export const ThemeContext = createContext({
  theme: THEMES.neon,
  setThemeId: (id) => {},
  viewMode: 'grid',
  setViewMode: (mode) => {},
  showTrail: true,
  setShowTrail: (show) => {},
  setPage: (page) => {},
});

export const MAJOR_GENRES = [
    "Action", "Romance", "Comedy", "Fantasy", "Drama"
];

// --- Helper Functions ---
export const normalizeTitle = (title) => {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/season \d+/g, "")
    .replace(/\d+(st|nd|rd|th) season/g, "")
    .replace(/the final season/g, "") 
    .replace(/part \d+/g, "")
    .replace(/cour \d+/g, "") 
    .replace(/ ii/g, "")
    .replace(/ iii/g, "")
    .replace(/:\s*$/, "") 
    .replace(/[^a-z0-9]/g, "") 
    .trim();
};

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

export const logActivity = async ({ userId, username, type, animeTitle, animeKitsuId, animeImageUrl, context, noteContent = null }) => {
  if (!db) return;
  try {
    await addDoc(collection(db, `artifacts/${appId}/public/data/activity`), {
        userId, 
        username, 
        type, 
        animeTitle, 
        animeKitsuId, 
        animeImageUrl, 
        context, 
        noteContent, 
        timestamp: serverTimestamp() 
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

export const exportUserData = (list, username) => {
    const dataStr = JSON.stringify(list, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anilog_${username}_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- Visual Components ---

// High Performance Particle Background
export function StarField({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if(!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const stars = Array.from({ length: 100 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5,
      opacity: Math.random(),
      speed: Math.random() * 0.2 + 0.05
    }));

    let animationId;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach(star => {
        star.y -= star.speed;
        if(star.y < 0) star.y = height;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      });
      animationId = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
    }
  }, [active]);

  if(!active) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />;
}

// Scramble Text Effect
function ScrambleText({ text, className }) {
  const [display, setDisplay] = useState(text);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

  useEffect(() => {
    let iter = 0;
    const interval = setInterval(() => {
      setDisplay(text.split("").map((char, index) => {
        if(index < iter) return text[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(""));
      
      if(iter >= text.length) clearInterval(interval);
      iter += 1/2; // speed
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{display}</span>;
}

function MouseTrail({ themeId, active }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, { stiffness: 500, damping: 20 }); // Smoother
  const smoothY = useSpring(y, { stiffness: 500, damping: 20 });
  
  const colors = {
      neon: 'rgba(59, 130, 246, 0.4)',
      toxic: 'rgba(132, 204, 22, 0.4)',
      sunset: 'rgba(244, 63, 94, 0.4)',
      indigo: 'rgba(99, 102, 241, 0.4)',
      orange: 'rgba(249, 115, 22, 0.4)',
      monochrome: 'rgba(255, 255, 255, 0.3)',
      emerald: 'rgba(16, 185, 129, 0.4)'
  };

  useEffect(() => {
    if (!active) return;
    const updateMouse = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('mousemove', updateMouse);
    return () => window.removeEventListener('mousemove', updateMouse);
  }, [active]);

  if (!active) return null;

  return (
    <>
        <motion.div 
            style={{ x: smoothX, y: smoothY, backgroundColor: colors[themeId] || colors.neon }}
            className="fixed top-0 left-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none z-[0] -translate-x-1/2 -translate-y-1/2 mix-blend-screen opacity-20"
        />
        <motion.div 
            style={{ x: smoothX, y: smoothY, backgroundColor: colors[themeId] || colors.neon }}
            className="fixed top-0 left-0 w-4 h-4 rounded-full blur-sm pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
        />
    </>
  )
}

export function AnimatedCounter({ value }) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

function ToastContainer({ toasts, removeToast }) {
    return createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(10px)' }}
                        layout
                        onClick={() => removeToast(toast.id)}
                        className={`p-4 rounded-xl shadow-2xl backdrop-blur-xl border cursor-pointer flex items-center gap-3 ${
                            toast.type === 'error' 
                                ? 'bg-red-500/20 border-red-500/50 text-red-200 shadow-red-500/10' 
                                : 'bg-white/10 border-white/20 text-white shadow-blue-500/10'
                        }`}
                    >
                        {toast.type === 'error' ? (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                        <span className="text-sm font-bold">{toast.message}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>,
        document.body
    );
}

function FooterInfo() {
    const { theme } = useContext(ThemeContext);
    return (
        <div className="w-full py-8 text-center flex flex-col items-center gap-2 mt-8 opacity-50 hover:opacity-100 transition-opacity">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Made by <span className={`${theme.accentText}`}>{CREATOR_NAME}</span>
            </p>
            <a href="https://paypal.me/KshrugalJain943" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-[10px] font-bold text-gray-400 hover:text-white border border-white/5 hover:border-white/10">
                <HeartIcon /> Support the Dev
            </a>
            <p className="text-[10px] text-gray-600">Press Cmd+K to search</p>
        </div>
    )
}

// --- Error Boundary Component ---
type ErrorBoundaryProps = React.PropsWithChildren;
type ErrorBoundaryState = { hasError: boolean; error: Error | null };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black mb-2">Something went wrong</h1>
          <p className="text-gray-400 max-w-md mb-8">The application encountered an unexpected error. You can try reloading the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- SVG Icons ---
// Manual SVG icons removed in favor of lucide-react imports.

export function AnimeCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col space-y-2">
      <div className="bg-white/5 rounded-xl aspect-[2/3] w-full border border-white/5"></div>
      <div className="h-4 bg-white/5 rounded w-3/4"></div>
      <div className="h-3 bg-white/5 rounded w-1/2"></div>
    </div>
  );
}

export function AnimeCarouselSkeleton({ title }) {
    return (
        <div className="space-y-4">
            {title && <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />}
            <div className="flex gap-4 overflow-hidden">
                {Array.from({length: 5}).map((_, i) => (
                    <div key={i} className="w-32 sm:w-40 flex-shrink-0 space-y-2 animate-pulse">
                         <div className="bg-white/5 rounded-xl aspect-[2/3] w-full border border-white/5" />
                         <div className="h-4 bg-white/5 rounded w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function AnimeCard({ anime, onCardClick, onQuickIncrement = undefined, viewMode = 'grid' }) {
    const { theme } = useContext(ThemeContext);
    
    // --- ADVANCED 3D TILT LOGIC (Motion Values instead of State) ---
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"]);
    const sheenGradient = useMotionTemplate`radial-gradient(
      circle at ${useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"])} ${useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"])}, 
      rgba(255, 255, 255, 0.15), 
      transparent 80%
    )`;

    const handleMouseMove = (e) => {
        if (viewMode === 'list') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXPos = e.clientX - rect.left;
        const mouseYPos = e.clientY - rect.top;
        const xPct = mouseXPos / width - 0.5;
        const yPct = mouseYPos / height - 0.5;
        mouseX.set(xPct);
        mouseY.set(yPct);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    const title = anime.title || anime.canonicalTitle || anime.attributes?.canonicalTitle || "Unknown Anime";
    const image = anime.imageUrl || 
                  anime.posterImage?.large || 
                  anime.posterImage?.medium || 
                  anime.posterImage?.original || 
                  anime.attributes?.posterImage?.large || 
                  anime.attributes?.posterImage?.medium || 
                  anime.attributes?.posterImage?.original || 
                  `https://placehold.co/300x450?text=${encodeURIComponent(title)}`;
    const progress = anime.watchedEpisodes ?? 0;
    const total = anime.totalEpisodes || anime.episodeCount || anime.attributes?.episodeCount || 0;
    const score = anime.score || 0;
    const status = anime.status;

    const isVn = anime.mediaType === 'vn' || anime.showType === 'Visual Novel' || anime.attributes?.showType === 'Visual Novel';
    const percentWidth = isVn ? progress : Math.min(100, (progress / (total || 12)) * 100);

    // Smart Airing Badge Logic
    const isAiring = !isVn && (status === 'current' || anime.attributes?.status === 'current');
    const nextEpDay = useMemo(() => {
        if(!isAiring) return null;
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const idNum = parseInt(anime.id || anime.kitsuId || "0");
        return days[idNum % 7];
    }, [anime.id, isAiring]);

    if (viewMode === 'list') {
        return (
            <motion.div 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={onCardClick}
                className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group relative overflow-hidden"
            >
                {/* Hover Glow Background */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${theme.gradient}`}></div>

                <img src={image || "https://placehold.co/100x150?text=?"} className="w-12 h-16 object-cover rounded-md shadow-md z-10" loading="lazy" alt={title} referrerPolicy="no-referrer" />
                <div className="flex-grow min-w-0 z-10">
                    <h4 className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">{title}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        {status && <span className="capitalize text-gray-500">{status === 'watching' && isVn ? 'reading' : status}</span>}
                        {isVn ? (
                            progress > 0 && <span>• {progress}% READ</span>
                        ) : (
                            total > 0 && <span>• {progress}/{total} EP</span>
                        )}
                        {score > 0 && <span className="text-yellow-500 flex items-center gap-1">★ {score}</span>}
                    </div>
                </div>
                {isAiring && (
                    <div className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold border border-blue-500/30 whitespace-nowrap z-10">
                        ON AIR: {nextEpDay}
                    </div>
                )}
                {onQuickIncrement && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onQuickIncrement(); }}
                        className={`p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${theme.accentText} z-10`}
                        title="Add Episode"
                    >
                        <PlusIcon />
                    </button>
                )}
            </motion.div>
        );
    }

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            style={{
                perspective: 1000
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onCardClick}
            className="group relative flex flex-col cursor-pointer"
        >
            <motion.div 
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 bg-gray-900"
            >
                <img src={image || "https://placehold.co/200x300?text=No+Image"} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" alt={title} referrerPolicy="no-referrer" />
                
                {/* Advanced Holographic Sheen */}
                <motion.div 
                   style={{ background: sheenGradient }}
                   className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20 mix-blend-overlay"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity z-10"></div>
                
                {score > 0 && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold text-yellow-400 border border-white/10 z-30 shadow-lg translate-z-10">
                        <StarIcon /> {score}
                    </div>
                )}

                {isAiring && (
                    <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-lg animate-pulse z-30">
                        ON AIR: {nextEpDay}
                    </div>
                )}

                {onQuickIncrement && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px] z-30">
                         <button 
                            onClick={(e) => { e.stopPropagation(); onQuickIncrement(); }}
                            className={`w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 hover:scale-110 transition-all border border-white/20 shadow-xl ${theme.accentText}`}
                         >
                             <PlusIcon />
                         </button>
                    </div>
                )}

                {progress > 0 && (
                     <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 z-30">
                          <div className={`h-full ${theme.progressbar}`} style={{ width: `${percentWidth}%` }}></div>
                     </div>
                )}
            </motion.div>
            
            <h3 className="font-bold text-sm text-gray-200 line-clamp-2 leading-tight group-hover:text-white transition-colors">{title}</h3>
            {isVn ? (
                progress > 0 && <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">{progress}% READ</p>
            ) : (
                total > 0 && <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">{progress} / {total} EP</p>
            )}
        </motion.div>
    );
}

export function AnimeCarousel({ title, animeList = [], onAnimeClick, isKitsuList = false }) {
    if (!animeList || animeList.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                    <ScrambleText text={title} className="" />
                </h3>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 px-2 no-scrollbar snap-x snap-mandatory">
                {animeList.map((anime, index) => {
                    let props = anime;
                    if (isKitsuList && anime.attributes) {
                        props = { ...anime.attributes, id: anime.id, kitsuId: anime.id };
                    }
                    return (
                        <div key={props.kitsuId || props.id || index} className="min-w-[140px] w-[140px] sm:min-w-[160px] sm:w-[160px] snap-start">
                            <AnimeCard anime={props} onCardClick={() => onAnimeClick(props)} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- Global Command Palette ---
function CommandPalette({ isOpen, onClose, setPage, theme, setThemeId, userId }) {
    const [query, setQuery] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if(isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const filteredActions = useMemo(() => {
        const q = query.toLowerCase();
        const actions = [
            { id: 'home', label: 'Go to Home', icon: <HomeIcon />, action: () => setPage('home') },
            { id: 'search', label: 'Go to Search', icon: <SearchIcon />, action: () => setPage('search') },
            { id: 'stats', label: 'Go to Stats', icon: <StatsIcon />, action: () => setPage('stats') },
            { id: 'social', label: 'Go to Social', icon: <SocialIcon />, action: () => setPage('social') },
            { id: 'profile', label: 'Go to Profile', icon: <ProfileIcon />, action: () => setPage('profile') },
        ];
        
        const themes = Object.values(THEMES).map(t => ({
            id: `theme-${t.id}`,
            label: `Theme: ${t.name}`,
            icon: <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${t.gradient}`}></div>,
            action: () => setThemeId(t.id)
        }));

        return [...actions, ...themes].filter(a => a.label.toLowerCase().includes(q));
    }, [query]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-start justify-center pt-[20vh]" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-lg bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="border-b border-white/10 p-4 flex items-center gap-3">
                    <SearchIcon />
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Type a command or search..."
                        className="bg-transparent w-full text-white focus:outline-none font-medium placeholder-gray-600"
                    />
                    <div className="text-xs font-mono text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/5">ESC</div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                    {filteredActions.map((action, i) => (
                        <button 
                            key={action.id}
                            onClick={() => { action.action(); onClose(); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-left transition-colors ${i === 0 ? 'bg-white/5' : ''}`}
                        >
                            <span className="text-gray-400">{action.icon}</span>
                            <span className="text-gray-200 text-sm font-medium">{action.label}</span>
                        </button>
                    ))}
                    {filteredActions.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">No commands found.</p>}
                </div>
            </motion.div>
        </div>
    );
}

// "The Oracle" Randomizer Modal
export function DeciderModal({ list, onClose, onSelect }) {
    const [shuffling, setShuffling] = useState(true);
    const [current, setCurrent] = useState(null);
    const [winner, setWinner] = useState(null);

    useEffect(() => {
        if(list.length === 0) return;
        
        // Shuffle Animation
        const interval = setInterval(() => {
            const random = list[Math.floor(Math.random() * list.length)];
            setCurrent(random);
        }, 100);

        // Stop after 2.5 seconds
        const timeout = setTimeout(() => {
            clearInterval(interval);
            const final = list[Math.floor(Math.random() * list.length)];
            setWinner(final);
            setShuffling(false);
        }, 2500);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        }
    }, [list]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={onClose}>
             <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl overflow-hidden relative"
                onClick={e => e.stopPropagation()}
             >
                 <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse" />
                 
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 flex items-center justify-center gap-2">
                     <DiceIcon /> The Oracle Speaks
                 </h3>

                 <div className="h-64 flex items-center justify-center mb-8 relative">
                     <AnimatePresence mode="wait">
                        {shuffling && current && (
                            <motion.div 
                                key={current.id}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -50, opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="absolute inset-0 flex flex-col items-center justify-center"
                            >
                                <img src={current.imageUrl} className="w-32 h-48 object-cover rounded-xl shadow-2xl mb-4 grayscale opacity-50" referrerPolicy="no-referrer" />
                                <h4 className="text-xl font-bold text-gray-500 truncate w-full px-4">{current.title}</h4>
                            </motion.div>
                        )}
                        {!shuffling && winner && (
                            <motion.div 
                                key="winner"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", bounce: 0.5 }}
                                className="absolute inset-0 flex flex-col items-center justify-center z-10"
                            >
                                <img src={winner.imageUrl} className="w-40 h-56 object-cover rounded-xl shadow-blue-500/50 shadow-2xl mb-4 border-2 border-white" referrerPolicy="no-referrer" />
                                <h4 className="text-2xl font-black text-white px-4">{winner.title}</h4>
                                <p className="text-blue-400 text-sm font-bold mt-2 uppercase">Your next mission</p>
                            </motion.div>
                        )}
                     </AnimatePresence>
                 </div>

                 {!shuffling && winner && (
                     <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onSelect(winner)}
                        className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors"
                     >
                         Accept Destiny
                     </motion.button>
                 )}
             </motion.div>
        </div>
    );
}

// "Captain's Log" Journal View
export function JournalView({ list }) {
    const notesList = list.filter(a => a.notes && a.notes.trim().length > 0);

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2"><DocumentTextIcon /> Captain's Log</h3>
            {notesList.length === 0 ? (
                <div className="text-center py-10 border border-white/5 rounded-2xl bg-white/5">
                    <p className="text-gray-500 font-medium">No log entries found.</p>
                    <p className="text-xs text-gray-600 mt-1">Add notes to anime in your collection to see them here.</p>
                </div>
            ) : (
                <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                    {notesList.map((item, index) => (
                        <div key={item.kitsuId || item.id || index} className="break-inside-avoid bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-3 border-b border-white/5 pb-3">
                                <img src={item.imageUrl} className="w-8 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                                <div>
                                    <p className="text-sm font-bold text-white line-clamp-1">{item.title}</p>
                                    <p className="text-[10px] text-gray-500 uppercase">{new Date(item.updatedAt || Date.now()).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-300 italic whitespace-pre-wrap">"{item.notes}"</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const loadPages = () => import('./features/Pages');
const AuthPage = lazy(() => loadPages().then(module => ({ default: module.AuthPage })));
const HomePage = lazy(() => loadPages().then(module => ({ default: module.HomePage })));
const SearchPage = lazy(() => loadPages().then(module => ({ default: module.SearchPage })));
const DiscoveryPage = lazy(() => loadPages().then(module => ({ default: module.DiscoveryPage })));
const SocialPage = lazy(() => loadPages().then(module => ({ default: module.SocialPage })));
const StatsPage = lazy(() => loadPages().then(module => ({ default: module.StatsPage })));
const ProfilePage = lazy(() => loadPages().then(module => ({ default: module.ProfilePage })));
const UserProfilePage = lazy(() => loadPages().then(module => ({ default: module.UserProfilePage })));

function PageLoadingFallback() {
  return <div className="py-24 text-center text-gray-500">Loading page…</div>;
}

function PreviewBanner() {
  if (!IS_PREVIEW) return null;
  return (
    <div className="sticky top-0 z-[70] border-b border-amber-400/30 bg-amber-400/15 px-4 py-2 text-center text-xs font-bold text-amber-100 backdrop-blur-xl">
      AniLog Preview — test build using the current AniLog backend. Use a test account for write-heavy testing.
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(!firebaseInitError);
  const [viewTargetUser, setViewTargetUser] = useState(null);
  const [guestMode, setGuestMode] = useState(() => sessionStorage.getItem('anilog_guest') === 'true');
  const [toasts, setToasts] = useState([]);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const page = getPageFromPath(location.pathname);

  useEffect(() => {
    const [baseTitle, description] = PAGE_META[page] || PAGE_META.home;
    const title = page === 'user_profile' && viewTargetUser?.username
      ? `${viewTargetUser.username} on AniLog`
      : baseTitle;
    document.title = title;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    descriptionMeta?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', description);

    const canonicalUrl = `https://anilog.app${location.pathname === '/' ? '/' : location.pathname}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
    document.querySelector('meta[property="twitter:url"]')?.setAttribute('content', canonicalUrl);
  }, [location.pathname, page, viewTargetUser?.username]);

  const setPage = useCallback((nextPage) => {
    navigate(PAGE_PATHS[nextPage] || '/');
  }, [navigate]);

  const openUserProfile = useCallback((targetUser) => {
    if (!targetUser?.uid) return;
    setViewTargetUser(targetUser);
    navigate(`/users/${encodeURIComponent(targetUser.uid)}`);
  }, [navigate]);

  const enterGuestMode = useCallback(() => {
    sessionStorage.setItem('anilog_guest', 'true');
    setGuestMode(true);
    navigate('/discover');
  }, [navigate]);

  const leaveGuestMode = useCallback(() => {
    sessionStorage.removeItem('anilog_guest');
    setGuestMode(false);
    navigate('/');
  }, [navigate]);
  
  // Persistent State
  const [themeId, setThemeId] = useState(() => localStorage.getItem('anilog_theme') || 'neon');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('anilog_view') || 'grid');
  const [showTrail, setShowTrail] = useState(() => localStorage.getItem('anilog_trail') !== 'false');

  // Effects to save state
  useEffect(() => localStorage.setItem('anilog_theme', themeId), [themeId]);
  useEffect(() => localStorage.setItem('anilog_view', viewMode), [viewMode]);
  useEffect(() => localStorage.setItem('anilog_trail', String(showTrail)), [showTrail]);

  // Global Keybind for Command Palette
  useEffect(() => {
      const down = (e) => {
          if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setIsCmdOpen((open) => !open);
          }
          if (e.key === 'Escape') setIsCmdOpen(false);
      }
      document.addEventListener('keydown', down);
      return () => document.removeEventListener('keydown', down);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Resolve shared/refreshed profile URLs without relying on in-memory state.
  useEffect(() => {
    if (page !== 'user_profile' || !db) return;
    const targetUid = decodeURIComponent(location.pathname.slice('/users/'.length));
    if (!targetUid || viewTargetUser?.uid === targetUid) return;

    let active = true;
    getDoc(doc(db, `artifacts/${appId}/public/data/users/${targetUid}`))
      .then((snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          setViewTargetUser({ ...snapshot.data(), uid: targetUid });
        } else {
          showToast('User profile not found.', 'error');
          navigate('/social', { replace: true });
        }
      })
      .catch(() => {
        if (!active) return;
        showToast('Could not load that profile.', 'error');
        navigate('/social', { replace: true });
      });

    return () => { active = false; };
  }, [location.pathname, navigate, page, showToast, viewTargetUser?.uid]);

  const triggerConfetti = useCallback(() => {
      const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899'];
      for(let i = 0; i < 50; i++) {
        const el = document.createElement('div');
        el.className = 'fixed w-3 h-3 rounded-sm z-[100]';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.top = '-20px';
        document.body.appendChild(el);
        const anim = el.animate([
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: `translateY(100vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
          duration: 1500 + Math.random() * 1000,
          easing: 'cubic-bezier(0,0,0.2,1)'
        });
        anim.onfinish = () => el.remove();
      }
      showToast("🎉 Activity Completed! 🎉", "success");
  }, [showToast]);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const theme = THEMES[themeId];

  // --- Animation Styles & Scrollbar Injection ---
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0px); opacity: 1; } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      .fade-in { animation: fade-in 0.3s ease-out forwards; }
      .slide-up { animation: slide-up 0.3s ease-out forwards; }
      .animate-pulse-fast { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      input[type=number] { -moz-appearance: textfield; }
      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.scrollbarThumb}; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [theme.scrollbarThumb]);

  // --- Auth Initialization ---
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const initializeAuth = async () => {
          try {
             if (!auth.currentUser) {
              await signInAnonymously(auth);
            }
          } catch (error) {
            console.error("Initial sign-in error:", error);
          }
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          setLoading(true);
          if (user) {
            if (!user.isAnonymous) {
              sessionStorage.removeItem('anilog_guest');
              setGuestMode(false);
            }
            setCurrentUser(user);
            setUserId(user.uid);

            try {
              const userDocRef = doc(db, `artifacts/${appId}/public/data/users/${user.uid}`);
              const userDocSnap = await getDoc(userDocRef);

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                // Email belongs in Firebase Authentication, not in a publicly
                // readable profile document. Clean up legacy profiles when
                // their owner next signs in.
                if (userData.email) {
                  await updateDoc(userDocRef, { email: deleteField() });
                }
                setUsername(userData.username || (user.email ? user.email.split("@")[0] : "Guest"));
              } else if (!user.isAnonymous) {
                const newUsername = user.email.split("@")[0];
                await setDoc(userDocRef, {
                  uid: user.uid,
                  username: newUsername,
                  createdAt: serverTimestamp(),
                  friends: [],
                });
                setUsername(newUsername);
              } else {
                setUsername("Guest");
              }
            } catch (error) {
              console.error("Error fetching/creating user profile:", error);
              setUsername(user.email ? user.email.split("@")[0] : "Guest");
            }
          } else {
            setCurrentUser(null);
            setUserId(null);
            setUsername("");
          }
          setLoading(false);
        });

        if (!auth.currentUser) {
          initializeAuth();
        }
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error("Error setting persistence:", error);
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      await signInAnonymously(auth);
      setPage("home");
      showToast("Logged out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (firebaseInitError) {
      return (
          <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-sans text-center px-4 relative">
              <StarField active={true} />
              <div className="flex flex-col items-center max-w-lg z-10">
                  <h1 className="text-4xl font-black mb-4 tracking-tight text-red-500">
                      Configuration Error
                  </h1>
                  <p className="text-gray-400 mb-6">
                      Firebase failed to initialize. Please ensure all environment variables are correctly set in your GitHub Secrets before deploying.
                  </p>
                  <pre className="text-xs bg-black/50 p-4 rounded-xl text-red-400 text-left overflow-auto w-full border border-red-500/30 whitespace-pre-wrap">
                      {firebaseInitError.message}
                  </pre>
              </div>
          </div>
      );
  }

  if (loading || !db) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white overflow-hidden relative">
                <StarField active={true} />
                <div className="flex flex-col items-center z-10">
                    <div className="relative w-24 h-24 mb-8">
                        <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-b-4 border-purple-500 animate-spin-slow"></div>
                        <div className="absolute inset-4 rounded-full border-r-4 border-emerald-500 animate-pulse"></div>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        {APP_NAME}
                    </h1>
                    <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Initializing Systems...</p>
                </div>
            </div>
        );
    }

  if (!currentUser || (currentUser.isAnonymous && !guestMode)) {
    return (
      <>
        <PreviewBanner />
        <Suspense fallback={<PageLoadingFallback />}>
          <AuthPage db={db} setPage={setPage} showToast={showToast} onContinueGuest={enterGuestMode} />
        </Suspense>
      </>
    );
  }

  const pageVariants = {
    initial: { opacity: 0, y: 10, filter: "blur(10px)" },
    in: { opacity: 1, y: 0, filter: "blur(0px)" },
    out: { opacity: 0, y: -10, filter: "blur(10px)" },
  };

  const pageTransition = { type: "spring", stiffness: 100, damping: 20, duration: 0.3 } as any;

  const renderPage = () => {
    console.log("Rendering page:", page);
    switch (page) {
      case "home": return guestMode
        ? <DiscoveryPage db={db} userId={userId} username={username} readOnly />
        : <HomePage db={db} userId={userId} username={username} showToast={showToast} />;
      case "search": return <SearchPage db={db} userId={userId} username={username} onConfetti={triggerConfetti} showToast={showToast} readOnly={guestMode} />;
      case "discovery": return <DiscoveryPage db={db} userId={userId} username={username} readOnly={guestMode} />;
      case "stats": return guestMode
        ? <DiscoveryPage db={db} userId={userId} username={username} readOnly />
        : <StatsPage db={db} userId={userId} username={username} />;
      case "social": return <SocialPage db={db} userId={userId} username={username} showToast={showToast} openUserProfile={openUserProfile} readOnly={guestMode} />;
      case "profile": return guestMode
        ? <DiscoveryPage db={db} userId={userId} username={username} readOnly />
        : <ProfilePage db={db} userId={userId} currentUser={currentUser} username={username} setUsername={setUsername} showToast={showToast} openUserProfile={openUserProfile} />;
      case "user_profile": return viewTargetUser
        ? <UserProfilePage db={db} currentUserId={userId} currentUsername={username} targetUser={viewTargetUser} showToast={showToast} setPage={setPage} readOnly={guestMode} />
        : <div className="py-24 text-center text-gray-500">Loading profile…</div>;
      default: return <HomePage db={db} userId={userId} username={username} showToast={showToast} />;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={{ theme, setThemeId, viewMode, setViewMode, showTrail, setShowTrail, setPage }}>
      <div className="min-h-screen bg-[#050505] text-gray-100 font-sans flex flex-col relative overflow-hidden selection:bg-white/20">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} setPage={setPage} theme={theme} setThemeId={setThemeId} userId={userId} />
        
        <StarField active={true} />
        <MouseTrail themeId={themeId} active={showTrail} />

        <PreviewBanner />
        
        {/* Dynamic Nebula - Physics Based */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{
              x: [0, 50, -50, 0],
              y: [0, -30, 30, 0],
              scale: [1, 1.2, 1],
              opacity: [0.15, 0.25, 0.15]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={`absolute top-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full blur-[150px] mix-blend-screen ${theme.accentBg.replace('bg-', 'bg-')}`}
          />
          <motion.div
            animate={{
              x: [0, -50, 50, 0],
              y: [0, 30, -30, 0],
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 2 }}
            className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-900/30 rounded-full blur-[150px] mix-blend-screen"
          />
        </div>
        
        <header className="sticky top-0 z-30 bg-[#050505]/60 backdrop-blur-xl border-b border-white/5">
          <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
            <h1 className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${theme.gradient} tracking-tight cursor-pointer drop-shadow-sm flex items-center gap-2`} onClick={() => setPage(guestMode ? 'discovery' : 'home')}>
              <ScrambleText text={APP_NAME} className="" />
            </h1>
            <div className="flex items-center space-x-2">
              {!guestMode && <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPage("stats")} title="Stats" className={`p-2 rounded-full transition-all duration-300 ${page === "stats" ? `bg-white/10 text-white ${theme.glow}` : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <StatsIcon />
              </motion.button>}
              {!guestMode && <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPage("profile")} title="Profile" className={`p-2 rounded-full transition-all duration-300 ${page === "profile" ? `bg-white/10 text-white ${theme.glow}` : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <ProfileIcon />
              </motion.button>}
              <motion.button whileTap={{ scale: 0.9 }} onClick={guestMode ? leaveGuestMode : handleLogout} title={guestMode ? "Sign in" : "Logout"} className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors">
                <LogoutIcon />
              </motion.button>
            </div>
          </nav>
        </header>

        {guestMode && (
          <div className="z-20 border-b border-blue-500/20 bg-blue-500/10 px-4 py-2 text-center text-xs text-blue-200">
            You’re exploring in read-only guest mode. <button onClick={leaveGuestMode} className="font-bold text-white underline underline-offset-2">Sign in or create an account</button> to track anime.
          </div>
        )}

        <main className="flex-grow container mx-auto p-4 pb-32 z-10">
          <AnimatePresence mode="popLayout">
            <motion.div key={page} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
              <Suspense fallback={<PageLoadingFallback />}>
                {renderPage()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
          
          <FooterInfo />
        </main>

        {/* Floating Magnetic Navigation Dock */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="relative flex items-center gap-2 px-3 py-2 bg-[#0a0a0a]/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
            {(guestMode ? ['search', 'discovery', 'social'] : ['home', 'search', 'discovery', 'social', 'stats']).map((navItem) => {
              const isActive = page === navItem;
              return (
                  <motion.button 
                      key={navItem} 
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }} 
                      onClick={() => setPage(navItem)} 
                      className={`relative p-3 rounded-xl transition-all duration-300 group overflow-hidden ${isActive ? "text-white" : "text-gray-500 hover:text-white"}`}
                  >
                      {isActive && (
                          <motion.div 
                              layoutId="nav-glow"
                              className={`absolute inset-0 rounded-xl bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                      )}
                      {/* Spotlight Effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-white/10 to-transparent pointer-events-none" />
                      
                      <div className="relative z-10">
                          {navItem === 'home' && <HomeIcon />}
                          {navItem === 'search' && <SearchIcon />}
                          {navItem === 'discovery' && <CompassIcon />}
                          {navItem === 'social' && <SocialIcon />}
                          {navItem === 'stats' && <StatsIcon />}
                      </div>
                  </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
    </ErrorBoundary>
  );
}
