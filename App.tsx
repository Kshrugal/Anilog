import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
  createContext,
} from "react";
import { createPortal } from "react-dom";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
  writeBatch,
  orderBy,
  addDoc,
  arrayUnion,
  arrayRemove, 
  deleteDoc
} from "firebase/firestore";
import { setLogLevel } from "firebase/firestore";
import { 
    motion, 
    AnimatePresence, 
    LayoutGroup, 
    useSpring, 
    useTransform, 
    useMotionValue, 
    useMotionTemplate, 
    useAnimationFrame,
    Reorder
} from "framer-motion";
import { 
  Search as SearchIcon, 
  Plus as PlusIcon, 
  User as ProfileIcon, 
  Home as HomeIcon, 
  BarChart2 as StatsIcon, 
  LogOut as LogoutIcon, 
  Check as CheckIcon, 
  X as CloseIcon, 
  ChevronRight as ChevronRightIcon,
  Star as StarIcon,
  Clock as ClockIcon,
  Play as PlayIcon,
  Info as InfoIcon,
  LayoutGrid as ViewGridIcon,
  Grid2X2 as GridIcon,
  List as ViewListIcon,
  Settings as SettingsIcon,
  MessageCircle as ChatIcon,
  Users as SocialIcon,
  Bell as BellIcon,
  Trophy as TrophyIcon,
  Calendar as CalendarIcon,
  Book as JournalIcon,
  Dices as DiceIcon,
  Sparkles as SparklesIcon,
  Tv as TvIcon,
  Film as FilmIcon,
  Trash2 as TrashIcon,
  Eye as EyeIcon,
  Heart as HeartIcon,
  Download as DownloadIcon,
  Layers as CardsIcon,
  FileText as DocumentTextIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
  Globe as GlobeIcon,
  Zap as ZapIcon,
  User as UserIcon,
  Compass as CompassIcon,
  Palette as PaletteIcon,
  Maximize2 as ExpandIcon,
  Minimize2 as ShrinkIcon,
  Share2 as ShareIcon,
  MoreVertical as MoreIcon,
  Move as DragIcon,
  Eraser as ClearIcon,
  Dna as DNAIcon
} from 'lucide-react';
import { toPng } from 'html-to-image';
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

const appId = import.meta.env.VITE_FIREBASE_APP_ID || hardcodedConfig.appId;

const APP_NAME = "AniLog";
const CREATOR_NAME = "KshrugalJain";

// --- Initialize Firebase ---
let app;
let auth;
let db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setLogLevel("silent"); 
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

// --- Kitsu API Configuration ---
const KITSU_API_URL = "https://kitsu.io/api/edge";
const AVG_EPISODE_MINUTES = 24;

// --- Unified Media Details Loader (Supports Kitsu and VNDB) ---
export const fetchMediaDetails = async (id) => {
  const strId = String(id);
  if (strId.startsWith('v')) {
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
const THEMES = {
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

const ThemeContext = createContext({
  theme: THEMES.neon,
  setThemeId: (id) => {},
  viewMode: 'grid',
  setViewMode: (mode) => {},
  showTrail: true,
  setShowTrail: (show) => {},
  setPage: (page) => {},
});

const MAJOR_GENRES = [
    "Action", "Romance", "Comedy", "Fantasy", "Drama"
];

// --- Helper Functions ---
const normalizeTitle = (title) => {
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

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const logActivity = async ({ userId, username, type, animeTitle, animeKitsuId, animeImageUrl, context, noteContent = null }) => {
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

const exportUserData = (list, username) => {
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
function StarField({ active }) {
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

function AnimatedCounter({ value }) {
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
class ErrorBoundary extends React.Component {
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

function AnimeCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col space-y-2">
      <div className="bg-white/5 rounded-xl aspect-[2/3] w-full border border-white/5"></div>
      <div className="h-4 bg-white/5 rounded w-3/4"></div>
      <div className="h-3 bg-white/5 rounded w-1/2"></div>
    </div>
  );
}

function AnimeCarouselSkeleton({ title }) {
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

function AnimeCard({ anime, onCardClick, onQuickIncrement = undefined, viewMode = 'grid' }) {
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

function AnimeCarousel({ title, animeList = [], onAnimeClick, isKitsuList = false }) {
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
function DeciderModal({ list, onClose, onSelect }) {
    const [shuffling, setShuffling] = useState(true);
    const [current, setCurrent] = useState(null);
    const [winner, setWinner] = useState(null);

    useEffect(() => {
        if(list.length === 0) return;
        
        let interval;
        let timeout;

        // Shuffle Animation
        interval = setInterval(() => {
            const random = list[Math.floor(Math.random() * list.length)];
            setCurrent(random);
        }, 100);

        // Stop after 2.5 seconds
        timeout = setTimeout(() => {
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
function JournalView({ list }) {
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

// --- Main App Component ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("home");
  const [viewTargetUser, setViewTargetUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  
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
            setCurrentUser(user);
            setUserId(user.uid);

            try {
              const userDocRef = doc(db, `artifacts/${appId}/public/data/users/${user.uid}`);
              const userDocSnap = await getDoc(userDocRef);

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                setUsername(userData.username || (user.email ? user.email.split("@")[0] : "Guest"));
              } else if (!user.isAnonymous) {
                const newUsername = user.email.split("@")[0];
                await setDoc(userDocRef, {
                  uid: user.uid,
                  email: user.email,
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

  if (!currentUser || currentUser.isAnonymous) {
    return <AuthPage db={db} setPage={setPage} showToast={showToast} />;
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
      case "home": return <HomePage db={db} userId={userId} username={username} showToast={showToast} />;
      case "search": return <SearchPage db={db} userId={userId} username={username} onConfetti={triggerConfetti} showToast={showToast} />;
      case "discovery": return <DiscoveryPage db={db} userId={userId} username={username} />;
      case "stats": return <StatsPage db={db} userId={userId} username={username} />;
      case "social": return <SocialPage db={db} userId={userId} username={username} showToast={showToast} setPage={setPage} setViewTargetUser={setViewTargetUser} />;
      case "profile": return <ProfilePage db={db} userId={userId} currentUser={currentUser} username={username} setUsername={setUsername} showToast={showToast} setPage={setPage} setViewTargetUser={setViewTargetUser} />;
      case "user_profile": return <UserProfilePage db={db} currentUserId={userId} currentUsername={username} targetUser={viewTargetUser} showToast={showToast} setPage={setPage} setViewTargetUser={setViewTargetUser} />;
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
            <h1 className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${theme.gradient} tracking-tight cursor-pointer drop-shadow-sm flex items-center gap-2`} onClick={() => setPage('home')}>
              <ScrambleText text={APP_NAME} className="" />
            </h1>
            <div className="flex items-center space-x-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPage("stats")} title="Stats" className={`p-2 rounded-full transition-all duration-300 ${page === "stats" ? `bg-white/10 text-white ${theme.glow}` : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <StatsIcon />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPage("profile")} title="Profile" className={`p-2 rounded-full transition-all duration-300 ${page === "profile" ? `bg-white/10 text-white ${theme.glow}` : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <ProfileIcon />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleLogout} title="Logout" className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors">
                <LogoutIcon />
              </motion.button>
            </div>
          </nav>
        </header>

        <main className="flex-grow container mx-auto p-4 pb-32 z-10">
          <AnimatePresence mode="popLayout">
            <motion.div key={page} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
          
          <FooterInfo />
        </main>

        {/* Floating Magnetic Navigation Dock */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="relative flex items-center gap-2 px-3 py-2 bg-[#0a0a0a]/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
            {['home', 'search', 'discovery', 'social', 'stats'].map((navItem) => {
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

function AuthPage({ db, setPage, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError("");
    if (isLogin) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setPage("home");
        showToast("Welcome back!", "success");
      } catch (err) {
        setError(err.message);
        showToast(err.message, "error");
      }
    } else {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (!username.trim()) { setError("Please enter a username."); return; }
      try {
        const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
        const q = query(usersRef, where("username", "==", username.trim()), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) { setError("Username taken."); showToast("Username taken", "error"); return; }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users/${user.uid}`);
        await setDoc(userDocRef, { uid: user.uid, email: user.email, username: username.trim(), createdAt: serverTimestamp(), friends: [] });
        setPage("home");
        showToast("Account created!", "success");
      } catch (err) { setError(err.message); showToast(err.message, "error"); }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden">
      <StarField active={true} />
      <div className="relative w-full max-w-md p-8 space-y-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-10">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-tighter">
            {APP_NAME}
          </h1>
          <p className="text-gray-400 text-sm">Track. Discover. Share.</p>
        </div>
        
        <form onSubmit={handleAuthAction} className="space-y-4">
          {!isLogin && (
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <motion.button whileTap={{ scale: 0.95 }} type="submit" className="w-full px-5 py-4 font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
            {isLogin ? "Sign In" : "Create Account"}
          </motion.button>
        </form>
        <button onClick={() => { setIsLogin(!isLogin); setError(""); }} className="w-full text-sm text-center text-gray-400 hover:text-white transition-colors">
          {isLogin ? "New to AniLog? Create Account" : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
}

function HomePage({ db, userId, username, showToast }) {
  const { theme, viewMode, setViewMode } = useContext(ThemeContext);
  const [myList, setMyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("watching");
  const [mediaFilter, setMediaFilter] = useState("all"); // 'all' | 'anime' | 'vn'
  const [selectedAnimeKitsuId, setSelectedAnimeKitsuId] = useState(null);
  const [selectedAnimeData, setSelectedAnimeData] = useState(null);
  const [heroAnime, setHeroAnime] = useState(null);
  
  const [sortBy, setSortBy] = useState("updated");
  const [localQuery, setLocalQuery] = useState("");
  
  // Decider Modal
  const [showDecider, setShowDecider] = useState(false);

  const statusTabs = ["watching", "completed", "planned", "dropped"];
  const greeting = useMemo(() => getGreeting(), []);

  useEffect(() => {
    if (!db || !userId) return;
    let isMounted = true;
    const listCollectionRef = collection(db, `artifacts/${appId}/public/data/users/${userId}/animeList`);
    setLoading(true);
    const unsubscribe = onSnapshot(
      listCollectionRef,
      (snapshot) => {
        if (!isMounted) return;
        const list = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as any));
        setMyList(list);
        
        const watching = list.filter(a => a.status === 'watching');
        if (watching.length > 0) {
            setHeroAnime(watching[Math.floor(Math.random() * watching.length)]);
        }

        setLoading(false);
      },
      (err) => { 
        console.error(err); 
        if (isMounted) {
            setError("Could not load your anime list."); 
            setLoading(false); 
        }
      }
    );
    return () => { isMounted = false; unsubscribe(); };
  }, [db, userId]);

  useEffect(() => {
    if (!selectedAnimeKitsuId) return;
    let isMounted = true;
    const fetchAnimeDetails = async () => {
      try {
        const data = await fetchMediaDetails(selectedAnimeKitsuId);
        if (isMounted) setSelectedAnimeData(data);
      } catch (err) { 
        console.error(err); 
        if (isMounted) {
            setSelectedAnimeKitsuId(null); 
            setSelectedAnimeData(null); 
        }
      }
    };
    fetchAnimeDetails();
    return () => { isMounted = false; };
  }, [selectedAnimeKitsuId]);

  const filteredList = useMemo(() => {
    let filtered = myList.filter((item) => item.status === statusFilter);
    
    if (mediaFilter !== 'all') {
        filtered = filtered.filter(item => {
            const isVn = item.mediaType === 'vn' || item.showType === 'Visual Novel';
            return mediaFilter === 'vn' ? isVn : !isVn;
        });
    }

    if (localQuery.trim()) {
        filtered = filtered.filter(item => 
            (item.title || "").toLowerCase().includes(localQuery.toLowerCase())
        );
    }

    return filtered.sort((a, b) => {
        if (sortBy === 'score') {
            return (b.score || 0) - (a.score || 0);
        } else if (sortBy === 'title') {
            return (a.title || "").localeCompare(b.title || "");
        } else {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        }
    });
  }, [myList, statusFilter, sortBy, localQuery, mediaFilter]);

  const handleQuickIncrement = async (anime) => {
    if(!db || !userId) return;
    const isVn = anime.mediaType === 'vn' || anime.showType === 'Visual Novel';
    const currentEp = anime.watchedEpisodes || 0;
    const totalEp = anime.totalEpisodes || 0;
    
    if(!isVn && totalEp > 0 && currentEp >= totalEp) return;
    if(isVn && currentEp >= 100) return;

    const newEp = isVn ? Math.min(100, currentEp + 5) : currentEp + 1;
    const docRef = doc(db, `artifacts/${appId}/public/data/users/${userId}/animeList`, anime.id);
    
    try {
        await updateDoc(docRef, { watchedEpisodes: newEp, updatedAt: Date.now() });
        logActivity({
            userId, 
            username, 
            type: 'progress', 
            animeTitle: anime.title, 
            animeKitsuId: anime.id, 
            animeImageUrl: anime.imageUrl, 
            context: isVn ? `read ${newEp}% of` : `watched episode ${newEp} of`
        });
        showToast(isVn ? `Marked ${newEp}% of ${anime.title}` : `Marked ep ${newEp} of ${anime.title}`, 'success');
    } catch(e) {
        console.error("Quick update failed", e);
        showToast("Failed to update", 'error');
    }
  };

  const gridVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const plannedList = myList.filter(a => a.status === 'planned');

  return (
    <div className="flex flex-col space-y-8">
      <div className="flex justify-between items-end pb-4 border-b border-white/5">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-1 flex items-center gap-2">
              {greeting}
          </h2>
          <p className="text-gray-500 text-sm">Welcome back, {username}.</p>
        </div>
      </div>

      {heroAnime && !loading && (
          <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="relative w-full h-72 rounded-3xl overflow-hidden shadow-2xl group cursor-pointer border border-white/10"
              onClick={() => setSelectedAnimeKitsuId(heroAnime.kitsuId)}
          >
              <img src={heroAnime.imageUrl} className="w-full h-full object-cover opacity-60 transition-transform duration-[2s] group-hover:scale-105" alt="hero" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8 w-full">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${theme.accentText}`}>
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span> Continue Watching
                  </p>
                  <h3 className="text-4xl font-black text-white mb-4 line-clamp-1">{heroAnime.title}</h3>
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <span className="text-gray-300 text-sm font-bold">Ep {heroAnime.watchedEpisodes} / {heroAnime.totalEpisodes || "?"}</span>
                          <div className="w-48 h-1.5 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                              <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: `${(heroAnime.watchedEpisodes / (heroAnime.totalEpisodes || 100)) * 100}%` }}
                                transition={{ duration: 1, ease: "circOut" }}
                                className={`h-full ${theme.progressbar}`} 
                              />
                          </div>
                      </div>
                      <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); handleQuickIncrement(heroAnime); }}
                          className="bg-white text-black px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-white/10 hover:shadow-white/20 transition-shadow"
                      >
                          <PlayIcon /> Watch Next
                      </motion.button>
                  </div>
              </div>
          </motion.div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex overflow-x-auto no-scrollbar gap-2 p-2 -mx-2">
                {statusTabs.map((status) => (
                <motion.button whileTap={{ scale: 0.95 }} key={status} onClick={() => setStatusFilter(status)} className={`px-6 py-2.5 capitalize font-bold rounded-full text-sm transition-all whitespace-nowrap ${statusFilter === status ? "bg-white text-black shadow-lg scale-105" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"}`}>
                    {status}
                </motion.button>
                ))}
            </div>
            {/* The Oracle Trigger */}
            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    if (plannedList.length < 2) {
                        showToast("Add more 'Planned' anime first!", "error");
                        return;
                    }
                    setShowDecider(true);
                }}
                className={`p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white shadow-lg`}
                title="Decide what to watch"
            >
                <DiceIcon />
            </motion.button>
        </div>

        {/* Media Filter Segmented Control */}
        <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
            {[
                { id: 'all', label: 'All' },
                { id: 'anime', label: 'Anime' },
                { id: 'vn', label: 'Visual Novels' }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setMediaFilter(tab.id)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mediaFilter === tab.id ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="flex items-center gap-2">
            <div className="relative flex-grow group">
                 <input 
                    type="text" 
                    value={localQuery} 
                    onChange={(e) => setLocalQuery(e.target.value)}
                    placeholder={`Search in ${statusFilter}...`}
                    className={`w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all backdrop-blur-sm focus:${theme.accentBorder.replace('border-', 'ring-')}`}
                 />
                 <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:${theme.accentText}`}><SearchIcon /></div>
                 {localQuery && (
                    <button onClick={() => setLocalQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1">
                        <CloseIcon />
                    </button>
                 )}
            </div>
            
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 backdrop-blur-sm">
                <button 
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-gray-500 hover:text-white transition-colors"
                    title="Toggle View"
                >
                    {viewMode === 'grid' ? <ViewListIcon /> : <ViewGridIcon />}
                </button>
                <div className="w-px bg-white/10 mx-1"></div>
                {[
                    { id: 'updated', label: 'New' },
                    { id: 'score', label: 'Top' },
                    { id: 'title', label: 'A-Z' }
                ].map(opt => (
                    <button 
                        key={opt.id} 
                        onClick={() => setSortBy(opt.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${sortBy === opt.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <LayoutGroup>
        <AnimatePresence mode="popLayout">
            <motion.div 
                key={`${statusFilter}-${sortBy}-${viewMode}`}
                variants={gridVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, scale: 0.95 }}
                className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6" : "flex flex-col gap-3"}
            >
                {loading && Array.from({ length: 10 }).map((_, index) => <AnimeCardSkeleton key={index} />)}
                {error && <p className="text-red-400 col-span-full text-center py-8 bg-red-900/20 rounded-xl border border-red-900/50">{error}</p>}
                
                {!loading && !error && filteredList.length === 0 && (
                    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                        <div className="text-7xl mb-4 opacity-50 grayscale">📺</div>
                        <p className="text-lg font-medium">Your "{statusFilter}" list is empty.</p>
                        {localQuery ? <p className="text-sm mt-2 text-gray-500">No matches for "{localQuery}"</p> : <p className="text-sm mt-2">Go to Search to find something to watch!</p>}
                    </motion.div>
                )}
                {!loading && !error && filteredList.map((anime) => (
                    <AnimeCard 
                        key={anime.id} 
                        anime={anime} 
                        onCardClick={() => setSelectedAnimeKitsuId(anime.kitsuId)} 
                        onQuickIncrement={statusFilter === 'watching' ? () => handleQuickIncrement(anime) : undefined}
                        viewMode={viewMode}
                    />
                ))}
            </motion.div>
        </AnimatePresence>
      </LayoutGroup>

      {selectedAnimeData && (
        <AnimeDetailsModal 
            anime={selectedAnimeData} 
            onClose={() => { setSelectedAnimeKitsuId(null); setSelectedAnimeData(null); }} 
            db={db} 
            userId={userId} 
            ownerId={userId}
            username={username}
        />
      )}

      {showDecider && (
          <DeciderModal 
            list={plannedList} 
            onClose={() => setShowDecider(false)} 
            onSelect={(anime) => {
                setShowDecider(false);
                setSelectedAnimeKitsuId(anime.kitsuId);
            }} 
          />
      )}
    </div>
  );
}

function SearchPage({ db, userId, username, onConfetti, showToast }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedAnime, setSelectedAnime] = useState(null);
    const [trending, setTrending] = useState([]);
    const [isSeasonal, setIsSeasonal] = useState(false);
    const [searchType, setSearchType] = useState("anime"); // 'anime' | 'vn'
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        let isMounted = true;
        fetch(`${KITSU_API_URL}/trending/anime?limit=10`)
            .then(res => res.json())
            .then(data => { if (isMounted) setTrending(data.data); })
            .catch(err => console.error(err));
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const delayDebounceFn = setTimeout(() => {
            if (isSeasonal) {
                // Fetch Current Season (approximation)
                setLoading(true);
                const year = new Date().getFullYear();
                fetch(`${KITSU_API_URL}/anime?filter[seasonYear]=${year}&sort=-userCount&page[limit]=20`)
                    .then(res => res.json())
                    .then(data => {
                        if (isMounted) {
                            setResults(data.data);
                            setLoading(false);
                        }
                    });
                return;
            }

            if (query.length < 3) {
                if (isMounted) setResults([]);
                return;
            }
            setLoading(true);

            if (searchType === 'vn') {
                fetch('https://api.vndb.org/kana/vn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filters: ["search", "=", query],
                        fields: 'id, title, alttitle, image.url, rating, length, description',
                        results: 20
                    })
                })
                .then(res => {
                    if (!res.ok) throw new Error("VNDB search failed");
                    return res.json();
                })
                .then(data => {
                    if (isMounted) {
                        const mapped = (data.results || []).map(vn => {
                            const canonicalTitle = vn.title || vn.alttitle || 'Unknown';
                            const posterUrl = vn.image?.url || '';
                            return {
                                id: vn.id,
                                kitsuId: vn.id,
                                title: canonicalTitle,
                                imageUrl: posterUrl,
                                totalEpisodes: 0,
                                watchedEpisodes: 0,
                                score: 0,
                                notes: "",
                                mediaType: 'vn',
                                showType: 'Visual Novel',
                                synopsis: vn.description || '',
                                attributes: {
                                    canonicalTitle,
                                    posterImage: {
                                        original: posterUrl,
                                        large: posterUrl,
                                        medium: posterUrl,
                                        small: posterUrl
                                    },
                                    showType: 'Visual Novel',
                                    episodeCount: vn.length ? `${vn.length}h` : 'N/A',
                                    averageRating: vn.rating ? (vn.rating / 10).toFixed(1) : null,
                                    synopsis: vn.description || ''
                                }
                            };
                        });
                        setResults(mapped);
                        setLoading(false);
                    }
                })
                .catch(err => {
                    console.error("VNDB Search err:", err);
                    if (isMounted) {
                        setResults([]);
                        setLoading(false);
                    }
                });
            } else {
                fetch(`${KITSU_API_URL}/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=20`)
                    .then(res => res.json())
                    .then(data => {
                        if (isMounted) {
                            setResults(data.data);
                            setLoading(false);
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        if (isMounted) setLoading(false);
                    });
            }
        }, 500);
        return () => {
            isMounted = false;
            clearTimeout(delayDebounceFn);
        };
    }, [query, isSeasonal, searchType]);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black text-white tracking-tight">Discover</h2>
                    <p className="text-sm text-gray-500">Find new stories to experience</p>
                </div>
                
                {searchType === 'anime' && (
                    <button 
                        onClick={() => { setIsSeasonal(!isSeasonal); setQuery(""); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${isSeasonal ? `bg-white text-black border-white` : `bg-white/5 text-gray-400 border-white/10 hover:text-white`}`}
                    >
                        <CalendarIcon /> Seasonal Radar
                    </button>
                )}
            </div>

            {/* Segmented Control for Media Search Type */}
            <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
                {[
                    { id: 'anime', label: 'Anime' },
                    { id: 'vn', label: 'Visual Novels' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setSearchType(tab.id);
                            setQuery("");
                            setResults([]);
                            setIsSeasonal(false);
                        }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${searchType === tab.id ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {!isSeasonal && (
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        className={`block w-full pl-12 pr-4 py-4 border border-white/10 rounded-2xl leading-5 bg-white/5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:${theme.accentBorder.replace('border-', 'ring-')} transition-all shadow-xl backdrop-blur-md`}
                        placeholder={searchType === 'anime' ? "Search for anime..." : "Search for visual novels..."}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            )}

            {isSeasonal && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-4">
                    <h3 className="text-lg font-bold text-white mb-1">Current Season Top Charts</h3>
                    <p className="text-xs text-gray-400">Most popular anime airing this year.</p>
                </div>
            )}

            {loading && (
                 <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white"></div>
                 </div>
            )}

            {!loading && results.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {results.map((anime) => {
                        const props = anime.mediaType === 'vn' 
                            ? anime 
                            : {...anime.attributes, id: anime.id, kitsuId: anime.id, mediaType: 'anime'};
                        return (
                            <AnimeCard 
                                key={anime.id} 
                                anime={props} 
                                onCardClick={() => setSelectedAnime(props)} 
                            />
                        );
                    })}
                </div>
            )}
            
            {!loading && results.length === 0 && query.length >= 3 && (
                <div className="text-center py-20 opacity-50">
                    <p className="text-xl font-bold">No results found for "{query}"</p>
                    <p className="text-sm">Try a different search term.</p>
                </div>
            )}

            {!loading && results.length === 0 && query.length < 3 && !isSeasonal && (
                <div>
                     {searchType === 'anime' ? (
                         <AnimeCarousel title="Trending Now" animeList={trending} onAnimeClick={setSelectedAnime} isKitsuList={true} />
                     ) : (
                         <div className="text-center py-12 text-gray-500 bg-white/5 rounded-2xl border border-white/10">
                             <p className="text-lg font-medium">Search for visual novels by typing in the search bar above.</p>
                             <p className="text-xs mt-1">Queried live from VNDB database.</p>
                         </div>
                     )}
                </div>
            )}

            {selectedAnime && (
                <AnimeDetailsModal 
                    anime={selectedAnime} 
                    onClose={() => setSelectedAnime(null)} 
                    db={db} 
                    userId={userId} 
                    ownerId={userId} 
                    username={username}
                    onComplete={onConfetti}
                />
            )}
        </div>
    );
}

function SocialPage({ db, userId, username, showToast, setPage, setViewTargetUser }) {
    const [feed, setFeed] = useState([]);
    const [users, setUsers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [view, setView] = useState("feed");
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        if (!db) return;
        let isMounted = true;
        const q = query(collection(db, `artifacts/${appId}/public/data/activity`), orderBy("timestamp", "desc"), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
             if (isMounted) {
                setFeed(snapshot.docs.map(doc => ({...doc.data(), id: doc.id})));
             }
        }, (error) => {
            console.error("Feed listener error:", error);
        });
        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [db]);

    useEffect(() => {
        if (!db || !userId) return;
        const unsubscribe = onSnapshot(doc(db, `artifacts/${appId}/public/data/users/${userId}`), (doc) => {
            if (doc.exists()) {
                setFriends(doc.data().friends || []);
            }
        });
        return () => unsubscribe();
    }, [db, userId]);

    useEffect(() => {
        if (searchQuery.length < 3) {
            setUsers([]);
            return;
        }
        const q = query(collection(db, `artifacts/${appId}/public/data/users`), where("username", ">=", searchQuery), where("username", "<=", searchQuery + '\uf8ff'), limit(10));
        getDocs(q).then(snapshot => {
            setUsers(snapshot.docs.map(d => d.data()).filter(u => u.uid !== userId));
        });
    }, [searchQuery, db, userId]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex space-x-6 border-b border-white/10 pb-4">
                <button onClick={() => setView('feed')} className={`text-2xl font-black transition-colors ${view === 'feed' ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>Activity</button>
                <button onClick={() => setView('friends')} className={`text-2xl font-black transition-colors ${view === 'friends' ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>My Friends</button>
                <button onClick={() => setView('search')} className={`text-2xl font-black transition-colors ${view === 'search' ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>Find Users</button>
            </div>

            {view === 'feed' && (
                <div className="space-y-4">
                    {feed.filter(item => {
                        const isMe = item.userId === userId;
                        const isFriend = friends.some(f => (f.uid === item.userId || f === item.userId));
                        return isMe || isFriend;
                    }).map(item => (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={item.id} 
                            className="bg-white/5 border border-white/5 p-4 rounded-2xl flex gap-4 items-center hover:bg-white/10 transition-all backdrop-blur-md group"
                        >
                            <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white text-lg shadow-lg border border-white/10 overflow-hidden bg-gradient-to-br ${theme.gradient}`}>
                                {item.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-grow">
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    <span className="font-bold text-white hover:text-blue-400 transition-colors cursor-pointer" onClick={() => { setViewTargetUser({uid: item.userId, username: item.username}); setPage("user_profile"); }}>{item.username}</span> 
                                    <span className="opacity-60 mx-1">{item.context}</span>
                                    <span className={`font-bold ${theme.accentText}`}>{item.animeTitle}</span>
                                </p>
                                {item.noteContent && (
                                    <div className="mt-2 bg-black/40 border-l-2 border-white/20 p-2 rounded text-xs text-gray-400 italic">
                                        "{item.noteContent}"
                                    </div>
                                )}
                                <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wider">{item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</p>
                            </div>
                            {item.animeImageUrl && (
                                <img src={item.animeImageUrl} className="w-10 h-14 object-cover rounded-lg shadow-xl border border-white/10 group-hover:scale-105 transition-transform" alt="anime" referrerPolicy="no-referrer" />
                            )}
                        </motion.div>
                    ))}
                    {feed.length === 0 && <div className="text-center py-20 text-gray-500 font-medium">No recent activity from you or your friends.</div>}
                </div>
            )}

            {view === 'friends' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {friends.map(friend => (
                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                key={friend.uid} 
                                onClick={() => { setViewTargetUser(friend); setPage("user_profile"); }} 
                                className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer flex items-center gap-4 transition-colors group"
                            >
                                <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center font-bold text-white text-xl border border-white/10 group-hover:border-white/30">
                                    {friend.username?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-white text-lg">{friend.username}</p>
                                    <p className="text-xs text-green-400 font-medium">Friend</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    {friends.length === 0 && <p className="text-center text-gray-500 py-10">You haven't added any friends yet.</p>}
                </div>
            )}

            {view === 'search' && (
                <div className="space-y-6">
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-12 pr-4 py-4 border border-white/10 rounded-2xl bg-white/5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {users.map(user => (
                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                key={user.uid} 
                                onClick={() => { setViewTargetUser(user); setPage("user_profile"); }} 
                                className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer flex items-center gap-4 transition-colors group"
                            >
                                <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center font-bold text-white text-xl border border-white/10 group-hover:border-white/30">
                                    {user.username?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-white text-lg">{user.username}</p>
                                    <p className="text-xs text-gray-500 font-medium">Click to view profile</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    {users.length === 0 && searchQuery.length >= 3 && <p className="text-center text-gray-500 py-10">No users found.</p>}
                </div>
            )}

            {selectedFriend && (
                <FriendListModal 
                    friend={selectedFriend} 
                    onClose={() => setSelectedFriend(null)} 
                    db={db} 
                    userId={userId} 
                    username={username} 
                    showToast={showToast}
                />
            )}
        </div>
    )
}

function AnimeDetailsModal({ anime, onClose, db, userId, ownerId, username, onComplete = undefined }) {
    const { theme } = useContext(ThemeContext);
    const [status, setStatus] = useState("watching");
    const [episodes, setEpisodes] = useState(0);
    const [score, setScore] = useState(0);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [existingData, setExistingData] = useState(null);
    const [fetchedGenres, setFetchedGenres] = useState([]); 
    const [cast, setCast] = useState([]);
    
    // Voice Actor Feature
    const [selectedCharacter, setSelectedCharacter] = useState(null);

    const title = anime.title || anime.canonicalTitle || anime.attributes?.canonicalTitle;
    const poster = anime.imageUrl || 
        anime.posterImage?.original || 
        anime.posterImage?.large || 
        anime.posterImage?.medium || 
        anime.posterImage?.small || 
        anime.attributes?.posterImage?.original || 
        anime.attributes?.posterImage?.large || 
        anime.attributes?.posterImage?.medium || 
        anime.attributes?.posterImage?.small || 
        anime.attributes?.coverImage?.original ||
        `https://placehold.co/300x450?text=${encodeURIComponent(title || '?')}`;
    const totalEps = anime.totalEpisodes || anime.episodeCount || anime.attributes?.episodeCount || 0;
    const synopsis = anime.synopsis || anime.attributes?.synopsis;
    const kitsuId = anime.kitsuId || anime.id;
    const isVn = anime.mediaType === 'vn' || anime.showType === 'Visual Novel' || anime.attributes?.showType === 'Visual Novel' || String(kitsuId).startsWith('v');
    const isKitsu = (!!anime.attributes || !!anime.canonicalTitle) && !isVn;

    const isOwner = userId === ownerId;

    useEffect(() => {
        if (!db || !ownerId || !kitsuId) return;
        
        // Fetch Genres & Cast if not present
        if (isKitsu && !fetchedGenres.length) {
            fetch(`${KITSU_API_URL}/anime/${kitsuId}/genres`)
                .then(r => r.json())
                .then(data => {
                    if(data.data) {
                        const g = data.data.map(item => item.attributes.name);
                        setFetchedGenres(g);
                    }
                }).catch(console.error);
                
             // Fetch Cast
            fetch(`https://kitsu.io/api/edge/casting?filter[media_type]=Anime&filter[media_id]=${kitsuId}&filter[is_character]=true&include=character,person&sort=-featured&page[limit]=6`)
                .then(res => res.json())
                .then(data => {
                    if (data.included) {
                        const chars = data.data.map(c => {
                             const charData = data.included.find(i => i.type === 'characters' && i.id === c.relationships.character.data.id);
                             const personData = data.included.find(i => i.type === 'people' && i.id === c.relationships.person.data.id);
                             return {
                                 id: c.id,
                                 name: charData?.attributes?.name,
                                 image: charData?.attributes?.image?.original,
                                 voiceActor: personData?.attributes?.name
                             }
                        });
                        setCast(chars);
                    }
                })
                .catch(err => console.error("Failed cast", err));
        }

        const fetchUserData = async () => {
            try {
                const docRef = doc(db, `artifacts/${appId}/public/data/users/${ownerId}/animeList`, String(kitsuId));
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setExistingData(data);
                    setStatus(data.status);
                    setEpisodes(data.watchedEpisodes);
                    setScore(data.score);
                    setNotes(data.notes || "");
                    if(data.genres) setFetchedGenres(data.genres); 
                } else if (isOwner) {
                    setStatus("watching");
                    setEpisodes(0);
                    setScore(0);
                }
            } catch(e) { console.error(e); }
        };
        fetchUserData();
    }, [db, ownerId, kitsuId, isOwner, isKitsu]);

    const handleSave = async () => {
        if (!isOwner) return;
        setLoading(true);
        try {
            const docRef = doc(db, `artifacts/${appId}/public/data/users/${userId}/animeList`, String(kitsuId));
            const data = {
                kitsuId: String(kitsuId),
                title,
                imageUrl: poster,
                totalEpisodes: totalEps,
                status,
                watchedEpisodes: Number(episodes),
                score: Number(score),
                notes,
                genres: fetchedGenres, 
                mediaType: isVn ? 'vn' : 'anime',
                showType: isVn ? 'Visual Novel' : (anime.showType || anime.attributes?.showType || ''),
                updatedAt: Date.now(),
            };
            
            await setDoc(docRef, data, { merge: true });

            if (!existingData) {
                const activityContext = isVn ? `added to ${status === 'watching' ? 'reading' : status}` : `added to ${status}`;
                await logActivity({ userId, username, type: 'add', animeTitle: title, animeKitsuId: kitsuId, animeImageUrl: poster, context: activityContext });
            } else {
                if (existingData.status !== status) {
                     const activityContext = isVn ? `moved to ${status === 'watching' ? 'reading' : status}` : `moved to ${status}`;
                     await logActivity({ userId, username, type: 'status_change', animeTitle: title, animeKitsuId: kitsuId, animeImageUrl: poster, context: activityContext });
                }
                if (existingData.score !== score && score > 0) {
                     await logActivity({ userId, username, type: 'rate', animeTitle: title, animeKitsuId: kitsuId, animeImageUrl: poster, context: `rated ${score}/10` });
                }
                if (existingData.notes !== notes && notes) {
                     await logActivity({ userId, username, type: 'note', animeTitle: title, animeKitsuId: kitsuId, animeImageUrl: poster, context: `added a note to`, noteContent: notes });
                }
                if (existingData.watchedEpisodes !== episodes && episodes > 0) {
                     if (isVn) {
                         if (episodes % 10 === 0) {
                             await logActivity({ userId, username, type: 'progress', animeTitle: title, animeKitsuId: kitsuId, animeImageUrl: poster, context: `read ${episodes}% of` });
                         }
                     } else if (episodes % 5 === 0) {
                         await logActivity({ userId, username, type: 'progress', animeTitle: title, animeKitsuId: kitsuId, animeImageUrl: poster, context: `watched ep ${episodes}` });
                     }
                }
            }

            if (status === 'completed' && (!existingData || existingData.status !== 'completed')) {
                if (onComplete) onComplete();
            }

            onClose();
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const statusColors = {
        watching: 'bg-green-500',
        completed: 'bg-blue-500',
        planned: 'bg-yellow-500',
        dropped: 'bg-red-500'
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 fade-in" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0a0a0a] w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden relative shadow-2xl flex flex-col md:flex-row border border-white/10" 
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md border border-white/10 transition-colors">
                    <CloseIcon />
                </button>

                <div className="relative w-full md:w-1/3 h-64 md:h-auto flex-shrink-0">
                    <img src={poster || "https://placehold.co/300x450"} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0a0a0a]" />
                    {score > 0 && (
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-yellow-500/30 flex items-center gap-2">
                             <StarIcon /> <span className="font-bold text-yellow-400">{score}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">{title}</h2>
                            {synopsis && (
                                <p className="text-gray-400 text-sm leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                                    {synopsis}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {fetchedGenres.slice(0, 5).map(g => (
                                    <span key={g} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-bold uppercase text-gray-300">{g}</span>
                                ))}
                            </div>
                        </div>

                        {/* Cast Section */}
                        {cast.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Main Cast</h4>
                                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                                    {cast.map(c => (
                                        <div key={c.id} className="flex-shrink-0 w-20 text-center group cursor-pointer" onClick={() => setSelectedCharacter(c)}>
                                            <div className="relative">
                                                <img src={c.image || "https://placehold.co/100"} className="w-16 h-16 rounded-full object-cover mx-auto border border-white/10 group-hover:border-white/50 transition-colors" referrerPolicy="no-referrer" />
                                            </div>
                                            <p className="text-[10px] text-white mt-1 line-clamp-1 font-bold">{c.name}</p>
                                            <p className="text-[9px] text-gray-500 line-clamp-1">{c.voiceActor}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isOwner ? (
                            <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                        {['watching', 'completed', 'planned', 'dropped'].map(s => (
                                            <button 
                                                key={s} 
                                                onClick={() => setStatus(s)}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all border ${status === s ? `bg-white text-black border-white shadow-lg` : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                                            >
                                                {s === 'watching' && isVn ? 'reading' : s}
                                            </button>
                                        ))}
                                    </div>

                                <div className="grid grid-cols-2 gap-6">
                                    {isVn ? (
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex justify-between">
                                                <span>Progress</span>
                                                <span className="text-white">{episodes}% READ</span>
                                            </label>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={episodes}
                                                onChange={(e) => setEpisodes(Number(e.target.value))}
                                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${theme.progressbar.replace('bg-', 'bg-')}/30`}
                                                style={{ backgroundSize: `${episodes}% 100%`, backgroundImage: `linear-gradient(${theme.accentBg.replace('bg-','').replace('hover:','')}, ${theme.accentBg.replace('bg-','').replace('hover:','')})`, backgroundRepeat: 'no-repeat' }}
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={() => setEpisodes(Math.max(0, episodes - 5))} className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-1 text-white text-sm font-bold">-5%</button>
                                                <button onClick={() => setEpisodes(Math.min(100, episodes + 5))} className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-1 text-white text-sm font-bold">+5%</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex justify-between">
                                                <span>Progress</span>
                                                <span className="text-white">{episodes} / {totalEps || '?'}</span>
                                            </label>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max={totalEps || 100} 
                                                value={episodes}
                                                onChange={(e) => setEpisodes(Number(e.target.value))}
                                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${theme.progressbar.replace('bg-', 'bg-')}/30`}
                                                style={{ backgroundSize: `${(episodes / (totalEps || 100)) * 100}% 100%`, backgroundImage: `linear-gradient(${theme.accentBg.replace('bg-','').replace('hover:','')}, ${theme.accentBg.replace('bg-','').replace('hover:','')})`, backgroundRepeat: 'no-repeat' }}
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={() => setEpisodes(Math.max(0, episodes - 1))} className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-1 text-white text-sm font-bold">-</button>
                                                <button onClick={() => setEpisodes(episodes + 1)} className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-1 text-white text-sm font-bold">+</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex justify-between">
                                            <span>Score</span>
                                            <span className={score > 0 ? "text-yellow-400" : "text-gray-600"}>{score > 0 ? score : '-'}</span>
                                        </label>
                                        <div className="flex gap-1">
                                            {[1,2,3,4,5,6,7,8,9,10].map(s => (
                                                <button 
                                                    key={s}
                                                    onMouseEnter={() => setScore(s)} 
                                                    onClick={() => setScore(s)}
                                                    className={`w-full aspect-square rounded-sm text-[0px] transition-colors ${s <= score ? 'bg-yellow-400 shadow-sm' : 'bg-gray-800'}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Notes</label>
                                    <textarea 
                                        value={notes} 
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="What are your thoughts?"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none h-20"
                                    />
                                </div>

                                <motion.button 
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSave}
                                    disabled={loading}
                                    className={`w-full py-4 rounded-xl font-black text-white shadow-lg ${theme.button} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? "Saving..." : "Update Log"}
                                </motion.button>
                            </div>
                        ) : (
                            <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusColors[status] || 'bg-gray-500'} text-white`}>
                                        {status}
                                    </span>
                                    {score > 0 && <span className="text-yellow-400 font-black text-xl flex items-center gap-1"><StarIcon /> {score}</span>}
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                    <span className="text-gray-400 font-bold">Progress</span>
                                    <span className="text-white font-mono text-lg">{episodes} <span className="text-gray-600">/ {totalEps || '?'}</span></span>
                                </div>
                                {notes && (
                                    <div className="bg-black/30 p-4 rounded-xl border-l-4 border-gray-600">
                                        <p className="text-gray-300 italic">"{notes}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}

// --- Discovery Page (Seasonal Hub) ---
function DiscoveryPage({ db, userId, username }) {
    const [trending, setTrending] = useState([]);
    const [topAiring, setTopAiring] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [topRated, setTopRated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnime, setSelectedAnime] = useState(null);
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [trendingRes, airingRes, upcomingRes, ratedRes] = await Promise.all([
                    fetch(`${KITSU_API_URL}/trending/anime?limit=10`).then(r => r.json()),
                    fetch(`${KITSU_API_URL}/anime?filter[status]=current&sort=-userCount&page[limit]=10`).then(r => r.json()),
                    fetch(`${KITSU_API_URL}/anime?filter[status]=upcoming&sort=-userCount&page[limit]=10`).then(r => r.json()),
                    fetch(`${KITSU_API_URL}/anime?sort=-averageRating&page[limit]=10`).then(r => r.json())
                ]);

                if (isMounted) {
                    setTrending(trendingRes.data || []);
                    setTopAiring(airingRes.data || []);
                    setUpcoming(upcomingRes.data || []);
                    setTopRated(ratedRes.data || []);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Discovery fetch error:", err);
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, []);

    const heroAnime = trending[0];

    if (loading) return <div className="space-y-12"><AnimeCarouselSkeleton title="Loading Hub..." /><AnimeCarouselSkeleton title="..." /></div>;

    return (
        <div className="space-y-12 pb-20">
            {/* Hero Section - Editorial Style */}
            {heroAnime && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative h-[60vh] min-h-[400px] rounded-[3rem] overflow-hidden group cursor-pointer shadow-2xl"
                    onClick={() => setSelectedAnime(heroAnime)}
                >
                    <img 
                        src={heroAnime.attributes.coverImage?.large || heroAnime.attributes.posterImage?.large} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                        alt="Hero"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent opacity-60" />
                    
                    <div className="absolute bottom-0 left-0 p-8 sm:p-12 space-y-4 max-w-2xl">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-white">#1 Trending</span>
                            <span className="px-3 py-1 bg-blue-500/20 backdrop-blur-md border border-blue-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">Seasonal Pick</span>
                        </div>
                        <h2 className="text-5xl sm:text-7xl font-black text-white tracking-tighter leading-none drop-shadow-2xl">
                            {heroAnime.attributes.canonicalTitle}
                        </h2>
                        <p className="text-gray-300 text-sm sm:text-lg line-clamp-3 max-w-xl font-medium leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                            {heroAnime.attributes.synopsis}
                        </p>
                        <div className="flex items-center gap-4 pt-4">
                            <button className={`px-8 py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-white/10`}>
                                View Details
                            </button>
                            <div className="flex items-center gap-2 text-white font-bold">
                                <StarIcon className="text-yellow-400" />
                                <span>{heroAnime.attributes.averageRating}%</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <AnimeCarousel title="Trending Now" animeList={trending} onAnimeClick={setSelectedAnime} isKitsuList={true} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-emerald-500 rounded-full"></div>
                        Top Airing
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {topAiring.slice(0, 6).map(anime => (
                            <AnimeCard key={anime.id} anime={{...anime.attributes, id: anime.id, kitsuId: anime.id}} onCardClick={() => setSelectedAnime(anime)} />
                        ))}
                    </div>
                </div>
                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-purple-500 rounded-full"></div>
                        Upcoming Hype
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {upcoming.slice(0, 6).map(anime => (
                            <AnimeCard key={anime.id} anime={{...anime.attributes, id: anime.id, kitsuId: anime.id}} onCardClick={() => setSelectedAnime(anime)} />
                        ))}
                    </div>
                </div>
            </div>

            <AnimeCarousel title="All-Time Masterpieces" animeList={topRated} onAnimeClick={setSelectedAnime} isKitsuList={true} />

            {selectedAnime && (
                <AnimeDetailsModal 
                    anime={selectedAnime.attributes ? selectedAnime : { attributes: selectedAnime }} 
                    onClose={() => setSelectedAnime(null)} 
                    db={db} 
                    userId={userId} 
                    ownerId={userId} 
                    username={username} 
                />
            )}
        </div>
    );
}

// --- Grids features removed as requested ---

function StatsPage({ db, userId, username }) {
  const { theme } = useContext(ThemeContext);
  const [myList, setMyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAnimeKitsuId, setSelectedAnimeKitsuId] = useState(null);
  const [selectedAnimeData, setSelectedAnimeData] = useState(null);
  const [genres, setGenres] = useState<Record<string, number>>({});
  const [selectedGenre, setSelectedGenre] = useState(null);

  useEffect(() => {
    if (!db || !userId) return;
    let isMounted = true;
    const listRef = collection(db, `artifacts/${appId}/public/data/users/${userId}/animeList`);
    setLoading(true);
    const unsubscribe = onSnapshot(listRef, (snapshot) => {
      if (!isMounted) return;
      const list = snapshot.docs.map((doc) => doc.data());
      setMyList(list);
      
      const genreCounts: Record<string, number> = {};
      list.forEach(a => {
          if (a.genres && Array.isArray(a.genres)) {
              a.genres.forEach(g => {
                  if(MAJOR_GENRES.includes(g)) {
                    genreCounts[g] = (genreCounts[g] || 0) + 1;
                  }
              });
          }
      });
      setGenres(genreCounts);
      setLoading(false);
    }, (err) => { 
      console.error(err); 
      if (isMounted) {
        setError("Could not load list."); 
        setLoading(false); 
      }
    });
    return () => { isMounted = false; unsubscribe(); };
  }, [db, userId]);

  // AUTO-SYNC GENRES
  useEffect(() => {
      if(myList.length > 0) {
          const missingGenres = myList.filter(a => !a.genres && a.kitsuId).slice(0, 3);
          missingGenres.forEach(anime => {
               fetch(`${KITSU_API_URL}/anime/${anime.kitsuId}/genres`)
                  .then(r => r.json())
                  .then(async (d) => {
                      if(d.data) {
                          const fetched = d.data.map(i => i.attributes.name);
                          await updateDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}/animeList`, String(anime.kitsuId)), { genres: fetched });
                      }
                  }).catch(console.error);
          });
      }
  }, [myList, db, userId]);

  const stats = useMemo(() => {
    let totalMinutes = 0;
    let totalEpisodesWatched = 0;
    let completedVnsCount = 0;
    let readingVnsCount = 0;
    const completed = [];
    const highestRated = [];
    const franchiseSet = new Set();

    // Status metrics
    let watchingAnime = 0;
    let readingVn = 0;
    let completedCount = 0;
    let onHoldCount = 0;
    let droppedCount = 0;
    let planningCount = 0;

    // Score distribution
    const scoreCounts = Array(10).fill(0);
    let ratedCount = 0;
    let sumScores = 0;

    for (const anime of myList) {
      const isVn = anime.mediaType === 'vn' || anime.showType === 'Visual Novel';
      
      // Status counting
      if (anime.status === 'watching') {
        if (isVn) readingVn++;
        else watchingAnime++;
      } else if (anime.status === 'completed') {
        completedCount++;
      } else if (anime.status === 'on_hold') {
        onHoldCount++;
      } else if (anime.status === 'dropped') {
        droppedCount++;
      } else if (anime.status === 'planning') {
        planningCount++;
      }

      // Score counting
      const score = Number(anime.score || 0);
      if (score >= 1 && score <= 10) {
        scoreCounts[score - 1]++;
        ratedCount++;
        sumScores += score;
      }

      if (isVn) {
        if (anime.status === 'completed') {
          completedVnsCount++;
          completed.push(anime);
        } else if (anime.status === 'watching') {
          readingVnsCount++;
        }
        if (anime.score === 10) highestRated.push(anime);
      } else {
        const eps = anime.status === 'completed' && anime.totalEpisodes > 0 ? anime.totalEpisodes : (anime.watchedEpisodes || 0);
        totalEpisodesWatched += eps;
        totalMinutes += eps * AVG_EPISODE_MINUTES;

        if (anime.status === "completed") {
          completed.push(anime);
          franchiseSet.add(normalizeTitle(anime.title));
        }
        if (anime.score === 10) highestRated.push(anime);
      }
    }

    const meanScore = ratedCount > 0 ? (sumScores / ratedCount).toFixed(1) : "0.0";
    
    // Median Score
    const sortedScores = myList.filter(a => Number(a.score || 0) > 0).map(a => Number(a.score)).sort((a, b) => a - b);
    let medianScore = "0.0";
    if (sortedScores.length > 0) {
      const mid = Math.floor(sortedScores.length / 2);
      if (sortedScores.length % 2 !== 0) {
        medianScore = sortedScores[mid].toFixed(1);
      } else {
        medianScore = ((sortedScores[mid - 1] + sortedScores[mid]) / 2).toFixed(1);
      }
    }

    const animeCount = myList.filter(a => !(a.mediaType === 'vn' || a.showType === 'Visual Novel')).length;
    const vnCount = myList.filter(a => (a.mediaType === 'vn' || a.showType === 'Visual Novel')).length;

    return {
      totalHours: (totalMinutes / 60).toFixed(0),
      totalCompletedUnique: franchiseSet.size, 
      totalEpisodes: totalEpisodesWatched,
      completedVnsCount,
      readingVnsCount,
      recentlyCompleted: completed.slice(-10).reverse(),
      topRated: highestRated.slice(0, 10),
      
      // New distribution stats
      statusDistribution: {
        watchingAnime,
        readingVn,
        completed: completedCount,
        onHold: onHoldCount,
        dropped: droppedCount,
        planning: planningCount,
        total: myList.length || 1
      },
      scoreDistribution: {
        counts: scoreCounts,
        meanScore,
        medianScore,
        ratedCount,
        maxCount: Math.max(...scoreCounts) || 1
      },
      formatDistribution: {
        animeCount,
        vnCount,
        total: myList.length || 1
      }
    };
  }, [myList]);

  useEffect(() => {
      if (!selectedAnimeKitsuId) return;
      let isMounted = true;
      const fetchD = async () => {
          try {
              const d = await fetchMediaDetails(selectedAnimeKitsuId);
              if (isMounted) setSelectedAnimeData(d);
          } catch(e) { console.error(e); }
      };
      fetchD();
      return () => { isMounted = false; };
  }, [selectedAnimeKitsuId]);

  const sd = stats.statusDistribution;
  const sc = stats.scoreDistribution;
  const fd = stats.formatDistribution;

  return (
    <div className="flex flex-col space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">Your Stats</h2>
          <p className="text-sm text-gray-500 mt-1">Detailed metrics of your experience log</p>
        </div>
      </div>

      {loading ? <AnimeCarouselSkeleton title="Loading..." /> : error ? <p className="text-red-400">{error}</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: "Hours Watched", val: stats.totalHours, color: theme.gradient },
                { label: "Completed Anime", val: stats.totalCompletedUnique, color: theme.gradient },
                { label: "Episodes", val: stats.totalEpisodes, color: theme.gradient },
                { label: "Completed VNs", val: stats.completedVnsCount, color: theme.gradient }
            ].map((stat, i) => (
                <motion.div whileHover={{ y: -5 }} key={i} className="p-6 bg-white/5 border border-white/5 rounded-2xl text-center shadow-xl backdrop-blur-sm hover:bg-white/10 transition-colors relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className={`text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br ${stat.color} tracking-tighter relative z-10`}>
                        <AnimatedCounter value={Number(stat.val)} />
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-gray-400 mt-2 uppercase tracking-wider relative z-10">{stat.label}</p>
                </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Taste Profile */}
              <div className="p-6 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-sm flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
                   <h3 className="text-xl font-black text-white mb-6 z-10">Taste Profile</h3>
                   <div className="w-full h-full z-10 relative flex items-center justify-center">
                       <GenreRadarChart counts={genres} theme={theme} onSelectGenre={setSelectedGenre} />
                   </div>
                   <div className={`absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-20 ${theme.accentBg}`}></div>
              </div>

              {/* Status and Library distribution */}
              <div className="p-6 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-sm flex flex-col justify-between relative overflow-hidden min-h-[400px]">
                   <div className="z-10">
                       <h3 className="text-xl font-black text-white mb-2">Library Distribution</h3>
                       <p className="text-xs text-gray-500">Current progress and status breakdown</p>

                       {/* Stacked Status Bar */}
                       <div className="h-4 w-full rounded-full bg-white/5 overflow-hidden flex gap-[2px] mt-6 shadow-inner">
                            {sd.watchingAnime > 0 && (
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(sd.watchingAnime / sd.total) * 100}%` }} 
                                    className="bg-emerald-500 h-full hover:brightness-110 transition-all cursor-pointer"
                                    title={`Watching: ${sd.watchingAnime} Anime`}
                                />
                            )}
                            {sd.readingVn > 0 && (
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(sd.readingVn / sd.total) * 100}%` }} 
                                    className="bg-teal-500 h-full hover:brightness-110 transition-all cursor-pointer"
                                    title={`Reading: ${sd.readingVn} VNs`}
                                />
                            )}
                            {sd.completed > 0 && (
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(sd.completed / sd.total) * 100}%` }} 
                                    className="bg-sky-500 h-full hover:brightness-110 transition-all cursor-pointer"
                                    title={`Completed: ${sd.completed}`}
                                />
                            )}
                            {sd.onHold > 0 && (
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(sd.onHold / sd.total) * 100}%` }} 
                                    className="bg-yellow-500 h-full hover:brightness-110 transition-all cursor-pointer"
                                    title={`On Hold: ${sd.onHold}`}
                                />
                            )}
                            {sd.dropped > 0 && (
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(sd.dropped / sd.total) * 100}%` }} 
                                    className="bg-red-500 h-full hover:brightness-110 transition-all cursor-pointer"
                                    title={`Dropped: ${sd.dropped}`}
                                />
                            )}
                            {sd.planning > 0 && (
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(sd.planning / sd.total) * 100}%` }} 
                                    className="bg-purple-500 h-full hover:brightness-110 transition-all cursor-pointer"
                                    title={`Planning: ${sd.planning}`}
                                />
                            )}
                       </div>

                       {/* Status Legend Grid */}
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                            {[
                                { label: "Watching", count: sd.watchingAnime, color: "bg-emerald-500", text: "text-emerald-400" },
                                { label: "Reading (VNs)", count: sd.readingVn, color: "bg-teal-500", text: "text-teal-400" },
                                { label: "Completed", count: sd.completed, color: "bg-sky-500", text: "text-sky-400" },
                                { label: "On Hold", count: sd.onHold, color: "bg-yellow-500", text: "text-yellow-400" },
                                { label: "Dropped", count: sd.dropped, color: "bg-red-500", text: "text-red-400" },
                                { label: "Planning", count: sd.planning, color: "bg-purple-500", text: "text-purple-400" }
                            ].map((st, idx) => (
                                <div key={idx} className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${st.color} mt-1`} />
                                    <div>
                                        <p className="text-xs font-bold text-gray-300 leading-none">{st.label}</p>
                                        <p className="text-xs text-gray-500 font-medium mt-1">
                                             {st.count} {st.count === 1 ? 'title' : 'titles'} • {((st.count / sd.total) * 100).toFixed(0)}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                       </div>
                   </div>

                   {/* Format Distribution (Anime vs Visual Novels) */}
                   <div className="z-10 mt-6 pt-6 border-t border-white/5 space-y-2">
                       <div className="flex justify-between items-center text-xs text-gray-400 font-bold uppercase tracking-wider">
                           <span>Anime Ratio</span>
                           <span>Visual Novels</span>
                       </div>
                       <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden flex shadow-inner">
                            <div className={`h-full ${theme.progressbar}`} style={{ width: `${(fd.animeCount / fd.total) * 100}%` }} />
                            <div className="h-full bg-indigo-500" style={{ width: `${(fd.vnCount / fd.total) * 100}%` }} />
                       </div>
                       <div className="flex justify-between text-xs text-gray-500 font-medium">
                           <span>{fd.animeCount} anime ({((fd.animeCount / fd.total) * 100).toFixed(0)}%)</span>
                           <span>{fd.vnCount} visual novels ({((fd.vnCount / fd.total) * 100).toFixed(0)}%)</span>
                       </div>
                   </div>
                   <div className={`absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[80px] opacity-10 bg-blue-500`}></div>
              </div>
          </div>

          {/* Full-width Score Distribution Section */}
          <div className="p-8 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-xl relative overflow-hidden">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6 mb-6">
                    <div>
                        <h3 className="text-xl font-black text-white">Score Distribution</h3>
                        <p className="text-xs text-gray-500 mt-1">Distribution frequency of your ratings (1 to 10 scale)</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                        <div className="px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Mean Score</p>
                            <p className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${theme.gradient} tracking-tight mt-1`}>{sc.meanScore}</p>
                        </div>
                        <div className="px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Median Score</p>
                            <p className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${theme.gradient} tracking-tight mt-1`}>{sc.medianScore}</p>
                        </div>
                        <div className="px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Total Rated</p>
                            <p className="text-2xl font-black text-white mt-1">{sc.ratedCount}</p>
                        </div>
                    </div>
               </div>

               {sc.ratedCount === 0 ? (
                   <div className="py-12 text-center text-gray-500">
                       <p className="text-sm">No scores rated yet. Click on any anime or visual novel to edit your entry and rate it!</p>
                   </div>
               ) : (
                   <div className="pt-6 relative">
                       {/* SVG/HTML Bar Columns */}
                       <div className="flex justify-between items-end h-48 w-full gap-2 sm:gap-4 px-2">
                           {sc.counts.map((count, index) => {
                               const scoreLabel = index + 1;
                               const heightPercent = count > 0 ? (count / sc.maxCount) * 100 : 0;
                               return (
                                   <div key={index} className="flex-grow flex flex-col justify-end items-center h-full group relative">
                                       {/* Hover Tooltip Count */}
                                       <AnimatePresence>
                                           <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-white text-black px-2 py-0.5 rounded text-[10px] font-bold shadow-md z-10 whitespace-nowrap">
                                               {count} {count === 1 ? 'title' : 'titles'}
                                           </div>
                                       </AnimatePresence>
                                       
                                       {/* Column Bar */}
                                       <motion.div 
                                           initial={{ height: 0 }}
                                           animate={{ height: `${heightPercent}%` }}
                                           transition={{ duration: 1, ease: "easeOut", delay: index * 0.05 }}
                                           className={`w-full max-w-[40px] bg-gradient-to-t ${theme.gradient} rounded-t-lg transition-all group-hover:brightness-125`}
                                           style={{ minHeight: count > 0 ? '6px' : '2px' }}
                                       />

                                       {/* Count text displayed at top of bar if count > 0 */}
                                       {count > 0 && (
                                           <span className="text-[10px] font-bold text-gray-400 mt-1 mb-1 block group-hover:text-white transition-colors">{count}</span>
                                       )}
                                       
                                       {/* Score label (1 to 10) */}
                                       <span className="text-xs font-bold text-gray-500 group-hover:text-white mt-2 transition-colors">{scoreLabel}</span>
                                   </div>
                               );
                           })}
                       </div>
                   </div>
               )}
               <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
          </div>

          <AnimeCarousel title="Recently Completed" animeList={stats.recentlyCompleted} onAnimeClick={(a) => setSelectedAnimeKitsuId(a.kitsuId)} isKitsuList={false} />
          <AnimeCarousel title="Masterpieces (10/10)" animeList={stats.topRated} onAnimeClick={(a) => setSelectedAnimeKitsuId(a.kitsuId)} isKitsuList={false} />
        </>
      )}
      {selectedAnimeData && <AnimeDetailsModal anime={selectedAnimeData} onClose={() => {setSelectedAnimeData(null); setSelectedAnimeKitsuId(null)}} db={db} userId={userId} ownerId={userId} username={username} />}
      
      {selectedGenre && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedGenre(null)}>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0a0a0a]/90 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 flex flex-col backdrop-blur-2xl" 
                onClick={e => e.stopPropagation()}
              >
                  <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-10 rounded-full bg-gradient-to-b ${theme.gradient}`}></div>
                        <div>
                          <h3 className="text-3xl font-black text-white tracking-tight leading-none">{selectedGenre}</h3>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-2">Genre Collection</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedGenre(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all border border-white/10 hover:rotate-90">
                        <CloseIcon />
                      </button>
                  </div>
                  <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-gradient-to-b from-transparent to-black/20">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {myList.filter(a => a.genres?.includes(selectedGenre)).map(a => (
                            <AnimeCard key={a.id} anime={a} onCardClick={() => { setSelectedGenre(null); setSelectedAnimeKitsuId(a.kitsuId); }} />
                        ))}
                    </div>
                    {myList.filter(a => a.genres?.includes(selectedGenre)).length === 0 && (
                        <div className="py-32 text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                <SearchIcon />
                            </div>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No anime found in this sector.</p>
                        </div>
                    )}
                  </div>
              </motion.div>
          </div>,
          document.body
      )}
    </div>
  );
}

function GenreRadarChart({ counts, theme, onSelectGenre }) {
    const sorted = MAJOR_GENRES.map(g => [g, counts[g] || 0]);
    const maxVal = Math.max(...sorted.map(s => s[1] as number)) || 1;
    
    const angleStep = (Math.PI * 2) / sorted.length;
    const radius = 100;
    const center = 150;

    const points = sorted.map((entry, i) => {
        const val = (entry[1] as number) / maxVal;
        const x = center + Math.cos(i * angleStep - Math.PI/2) * (radius * val);
        const y = center + Math.sin(i * angleStep - Math.PI/2) * (radius * val);
        return `${x},${y}`;
    }).join(" ");

    const bgPoints = sorted.map((_, i) => {
        const x = center + Math.cos(i * angleStep - Math.PI/2) * radius;
        const y = center + Math.sin(i * angleStep - Math.PI/2) * radius;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg viewBox="0 0 300 300" className="w-full h-full max-h-[350px]">
            {/* Background Web */}
            <polygon points={bgPoints} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            {[0.25, 0.5, 0.75].map(scale => {
                 const scaledPoints = sorted.map((_, i) => {
                    const x = center + Math.cos(i * angleStep - Math.PI/2) * (radius * scale);
                    const y = center + Math.sin(i * angleStep - Math.PI/2) * (radius * scale);
                    return `${x},${y}`;
                }).join(" ");
                return <polygon key={scale} points={scaledPoints} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            })}

            {/* Data Shape with Draw Animation */}
            <motion.polygon 
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                points={points} 
                className={`${theme.accentText.replace('text-', 'fill-')} stroke-white`}
                strokeWidth="2"
                strokeLinejoin="round"
                fillOpacity="0.5"
                transform-origin="center"
            />

            {/* Labels - Clickable */}
            {sorted.map((entry, i) => {
                const x = center + Math.cos(i * angleStep - Math.PI/2) * (radius + 25);
                const y = center + Math.sin(i * angleStep - Math.PI/2) * (radius + 25);
                const isActive = (entry[1] as number) > 0;
                return (
                    <g key={i} onClick={() => onSelectGenre(entry[0])} style={{ cursor: 'pointer' }}>
                         <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={isActive ? "white" : "gray"} className="text-[10px] font-bold uppercase tracking-wider transition-colors hover:fill-blue-400" style={{ textShadow: isActive ? '0 2px 4px black' : 'none' }}>
                            {entry[0]}
                        </text>
                        <text x={x} y={y + 12} textAnchor="middle" fill="gray" fontSize="8">{entry[1]}</text>
                    </g>
                );
            })}
        </svg>
    );
}

function ProfilePage({ db, userId, currentUser, username, setUsername, showToast, setPage, setViewTargetUser }) {
  const { theme, setThemeId, showTrail, setShowTrail } = useContext(ThemeContext);
  const [newUsername, setNewUsername] = useState(username);
  const [hallOfFame, setHallOfFame] = useState([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  const [activityData, setActivityData] = useState([]); 
  const [myList, setMyList] = useState([]);
  
  // Tabs: overview, journal, settings
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
      if(!db || !userId) return;
      const unsub = onSnapshot(doc(db, `artifacts/${appId}/public/data/users/${userId}`), (doc) => {
          if(doc.exists()) {
              setHallOfFame(doc.data().hallOfFame || Array(10).fill(null));
          } else {
              setHallOfFame(Array(10).fill(null));
          }
      });
      return () => unsub();
  }, [db, userId]);

  useEffect(() => {
      if(!db || !userId) return;
      // Get Activities
      const q = query(collection(db, `artifacts/${appId}/public/data/activity`), where("userId", "==", userId), limit(100));
      getDocs(q).then(snap => {
          setActivityData(snap.docs.map(d => d.data()));
      });
      // Get Full List for Export/Journal
      const listQ = collection(db, `artifacts/${appId}/public/data/users/${userId}/animeList`);
      getDocs(listQ).then(snap => {
          setMyList(snap.docs.map(d => d.data()));
      });
  }, [db, userId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if(newUsername === username || newUsername.length < 3) return;
    const q = query(collection(db, `artifacts/${appId}/public/data/users`), where("username", "==", newUsername.trim()), limit(1));
    if(!(await getDocs(q)).empty) { showToast("Username taken.", 'error'); return; }
    await updateDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}`), { username: newUsername.trim() });
    setUsername(newUsername.trim());
    showToast("Profile Updated!", 'success');
  };

  const handleSlotClick = (index) => {
      setActiveSlotIndex(index);
      setIsSelectorOpen(true);
  };

  const updateHallOfFame = async (anime, overrideTitle = null) => {
      const newHall = [...hallOfFame];
      if(anime === null) {
          newHall[activeSlotIndex] = null;
      } else {
          const img = anime.attributes.posterImage;
          const imageSrc = img?.original || img?.large || img?.medium || img?.small || img?.tiny || "https://placehold.co/200x300?text=No+Image";
          
          newHall[activeSlotIndex] = {
              id: anime.id,
              title: overrideTitle || anime.attributes.canonicalTitle,
              image: imageSrc
          };
      }
      await updateDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}`), { hallOfFame: newHall });
      setIsSelectorOpen(false);
  };

  const [draggedIdx, setDraggedIdx] = useState(null);

  const handleDragStart = (e, idx) => {
      setDraggedIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
      e.preventDefault();
  };

  const handleDrop = async (e, dropIndex) => {
      e.preventDefault();
      if (draggedIdx === null || draggedIdx === dropIndex) return;

      const newHof = [...hallOfFame];
      const draggedItem = newHof[draggedIdx];
      newHof.splice(draggedIdx, 1);
      newHof.splice(dropIndex, 0, draggedItem);
      
      while(newHof.length < 10) newHof.push(null);
      newHof.length = 10;

      setHallOfFame(newHof);
      setDraggedIdx(null);
      await updateDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}`), { hallOfFame: newHof });
  };

  const stats = useMemo(() => {
      let totalHours = 0;
      let totalEps = 0;
      let completed = 0;
      let sumScores = 0;
      let ratedCount = 0;
      
      myList.forEach(a => {
          const eps = a.status === 'completed' && a.totalEpisodes > 0 ? a.totalEpisodes : (a.watchedEpisodes || 0);
          totalEps += eps;
          totalHours += eps * 24; // Average 24 minutes per episode
          if(a.status === 'completed') completed++;
          if(a.score > 0) {
              sumScores += a.score;
              ratedCount++;
          }
      });
      
      const daysWatched = totalHours > 0 ? (totalHours / 60 / 24).toFixed(1) : 0;
      const meanScore = ratedCount > 0 ? (sumScores / ratedCount).toFixed(1) : "0.0";
      
      return { 
          total: myList.length,
          daysWatched,
          meanScore
      };
  }, [myList]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-6">
      {/* Profile Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-end pb-4 border-b border-white/10 gap-4">
           <div>
               <div className="flex items-center gap-3">
                   <h2 className="text-4xl font-black text-white tracking-tighter">{username}</h2>
                   <button 
                       onClick={() => { setViewTargetUser({uid: userId, username}); setPage("user_profile"); }}
                       className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors flex items-center gap-1"
                   >
                       <UserIcon size={14} /> Public View
                   </button>
               </div>
               <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mt-1">Pilot Profile</p>
           </div>
           <div className="flex bg-white/5 p-1 rounded-xl">
               {['overview', 'journal', 'settings'].map(tab => (
                   <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === tab ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                   >
                       {tab}
                   </button>
               ))}
           </div>
      </div>
      
      {activeTab === 'overview' && (
          <>
            {/* Stats Panel */}
            <div className="bg-[#0f111a] border border-white/5 rounded-xl p-8 shadow-xl">
                <div className="grid grid-cols-3 divide-x divide-white/5">
                    <div className="text-center">
                        <p className="text-3xl font-black text-[#3db4f2] mb-1">{stats.total}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Anime</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black text-[#3db4f2] mb-1">{stats.daysWatched}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Days Watched</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black text-[#3db4f2] mb-1">{stats.meanScore}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mean Score</p>
                    </div>
                </div>
                {/* Progress Bar Visualizer */}
                <div className="mt-8 relative h-3 bg-white/5 rounded-full overflow-hidden">
                     <div className="absolute top-0 left-0 h-full bg-[#3db4f2] rounded-full" style={{ width: `${Math.min(100, (stats.total / 100) * 100)}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-600 font-bold px-1">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                </div>
            </div>

            {/* Hall of Fame */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none" />
                <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2 relative z-10"><TrophyIcon /> Hall of Fame</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 relative z-10">
                    {hallOfFame.map((item, i) => (
                        <motion.div 
                            draggable
                            onDragStart={(e) => handleDragStart(e, i)}
                            onDragOver={(e) => handleDragOver(e, i)}
                            onDrop={(e) => handleDrop(e, i)}
                            whileHover={{ scale: 1.05, y: -5 }}
                            key={i} 
                            onClick={() => handleSlotClick(i)}
                            className={`aspect-[2/3] rounded-xl border-2 border-dashed ${item ? 'border-transparent shadow-lg' : 'border-white/10 hover:border-white/30'} flex items-center justify-center cursor-pointer relative overflow-hidden bg-black/20 group transition-all`}
                        >
                            {item ? (
                                <>
                                    <img src={item.image || "https://placehold.co/200x300?text=?"} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center z-10">
                                        <p className="text-xs font-bold text-white mb-2">{item.title}</p>
                                        <p className="text-[10px] text-gray-400">Click to Edit</p>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30" />
                                </>
                            ) : (
                                <span className="text-xs font-black text-white/30 uppercase tracking-widest">Slot {i + 1}</span>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Activity Heatmap */}
            <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
                <h3 className="text-xl font-black text-white mb-4">Activity Heatmap</h3>
                <ActivityHeatmap data={activityData} theme={theme} />
            </div>
          </>
      )}

      {activeTab === 'journal' && (
           <JournalView list={myList} />
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl space-y-6">
                <div>
                    <h3 className="text-xl font-black text-white mb-4">Themes</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(THEMES).map(t => (
                            <button 
                                key={t.id} 
                                onClick={() => setThemeId(t.id)}
                                className={`relative p-3 rounded-xl border transition-all overflow-hidden group text-left ${theme.id === t.id ? 'border-white ring-1 ring-white/50' : 'border-white/10 hover:border-white/30'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                                <div className="relative flex items-center justify-between mb-2">
                                    <span className="font-bold text-xs text-white uppercase tracking-wider">{t.name}</span>
                                    {theme.id === t.id && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
                                </div>
                                <div className={`h-1 w-full rounded-full ${t.progressbar}`}></div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl">
                    <span className="font-bold text-sm text-gray-300">Mouse Trail</span>
                    <button 
                        onClick={() => setShowTrail(!showTrail)}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors ${showTrail ? theme.accentBg : 'bg-gray-700'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${showTrail ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                <div className="p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                        <UserIcon className="text-blue-400" size={20} />
                        Identity
                    </h3>
                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Display Name</label>
                            <input 
                                type="text" 
                                value={newUsername} 
                                onChange={e => setNewUsername(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                placeholder="Enter new username..."
                            />
                        </div>
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit" 
                            disabled={newUsername === username}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl transition-all disabled:opacity-50 ${theme.button}`}
                        >
                            Update Profile
                        </motion.button>
                    </form>
                </div>

                <div className="p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                        <ShieldIcon className="text-emerald-400" size={20} />
                        Security & Privacy
                    </h3>
                    <div className="space-y-4 relative z-10">
                        <div className="p-5 bg-black/40 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                            <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                <LockIcon size={14} className="text-emerald-500" />
                                Encrypted Session
                            </p>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">Your session is protected by Firebase Authentication. We never store or see your password.</p>
                        </div>
                        <div className="p-5 bg-black/40 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                            <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                <EyeOffIcon size={14} className="text-emerald-500" />
                                Privacy First
                            </p>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">Only your public username and anime list are visible to others. Your email remains strictly private.</p>
                        </div>
                        <div className="p-5 bg-black/40 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                            <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                <GlobeIcon size={14} className="text-emerald-500" />
                                Safe Sharing
                            </p>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">Shared profile URLs do not contain any sensitive API keys or personal identifiers.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                        <DownloadIcon className="text-orange-400" size={20} />
                        Data Portability
                    </h3>
                    <p className="text-xs text-gray-400 mb-6 leading-relaxed font-medium">
                        You own your data. Export your entire anime list and activity history as a standard JSON file at any time.
                    </p>
                    <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => exportUserData(myList, username)}
                        className="w-full py-4 flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-black text-white uppercase tracking-widest transition-all"
                    >
                        <DownloadIcon size={18} />
                        Export My Data
                    </motion.button>
                </div>
            </div>
        </div>
      )}
      
      {isSelectorOpen && <HallOfFameSelector onClose={() => setIsSelectorOpen(false)} onSelect={updateHallOfFame} myList={myList} />}
    </div>
  );
}

function ActivityHeatmap({ data, theme }) {
    const days = useMemo(() => {
        const d = [];
        for(let i=0; i<60; i++) { 
             d.push({ count: 0 });
        }
        data.forEach(item => {
             const idx = Math.floor(Math.random() * 60);
             d[idx].count++;
        });
        return d;
    }, [data]);

    return (
        <div className="flex gap-1 flex-wrap">
            {days.map((day, i) => {
                let color = "bg-white/5";
                if(day.count > 0) color = "bg-blue-900";
                if(day.count > 2) color = "bg-blue-600";
                if(day.count > 5) color = "bg-blue-400";
                
                return (
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.01 }}
                        key={i} 
                        className={`w-3 h-3 rounded-sm ${color}`} 
                        title={`${day.count} activities`} 
                    />
                )
            })}
        </div>
    )
}

function HallOfFameSelector({ onClose, onSelect, myList }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [override, setOverride] = useState("");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if(query.length < 3) return;
            
            const localMatches = (myList || [])
                .filter(a => a.title.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 15)
                .map(a => ({
                    id: a.kitsuId,
                    isLocal: true,
                    attributes: {
                        canonicalTitle: a.title,
                        posterImage: { tiny: a.imageUrl || a.posterImage?.tiny }
                    }
                }));

            try {
                const r = await fetch(`${KITSU_API_URL}/anime?filter[text]=${query}&page[limit]=15`);
                const d = await r.json();
                
                const combined = [...localMatches];
                d.data.forEach(apiItem => {
                    if (!combined.some(c => String(c.id) === String(apiItem.id))) {
                        combined.push(apiItem);
                    }
                });
                
                setResults(combined.slice(0, 20));
            } catch (e) {
                setResults(localMatches);
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [query, myList]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-900 w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl" 
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold text-white mb-4">Select Anime</h3>
                
                {!selected ? (
                    <>
                        <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white mb-4 focus:outline-none focus:border-blue-500" />
                        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                            <button onClick={() => onSelect(null)} className="w-full p-3 text-left text-red-400 hover:bg-white/5 rounded-lg">Remove from slot</button>
                            {results.map(anime => (
                                <div key={anime.id} onClick={() => setSelected(anime)} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <img src={anime.attributes.posterImage?.tiny || "https://placehold.co/40x56?text=?"} className="w-10 h-14 object-cover rounded border border-white/5" referrerPolicy="no-referrer" />
                                        <div>
                                            <span className="text-white font-medium block">{anime.attributes.canonicalTitle}</span>
                                            {anime.isLocal && <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">In Library</span>}
                                        </div>
                                    </div>
                                    <span className="text-white/20 group-hover:text-white/50 transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl">
                             <img src={selected.attributes.posterImage?.tiny} className="w-12 h-16 object-cover rounded" referrerPolicy="no-referrer" />
                             <span className="text-white font-bold">{selected.attributes.canonicalTitle}</span>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Override Title (Optional)</label>
                            <input type="text" value={override} onChange={e => setOverride(e.target.value)} placeholder="e.g. 'The GOAT'" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white" />
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setSelected(null)} className="flex-1 py-2 bg-white/5 rounded-lg text-white">Back</button>
                             <button onClick={() => onSelect(selected, override)} className="flex-1 py-2 bg-blue-600 rounded-lg text-white font-bold">Confirm</button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

function UserProfilePage({ db, currentUserId, currentUsername, targetUser, showToast, setPage, setViewTargetUser }) {
    const [list, setList] = useState([]);
    const [myList, setMyList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("watching");
    const [tab, setTab] = useState("overview"); // 'overview', 'library', 'compare'
    const [selectedAnimeKitsuId, setSelectedAnimeKitsuId] = useState(null);
    const [selectedAnimeData, setSelectedAnimeData] = useState(null);
    const [searchQuery, setSearchQuery] = useState(""); 
    const { theme } = useContext(ThemeContext);
    const [friendHallOfFame, setFriendHallOfFame] = useState([]);
    const [isFriend, setIsFriend] = useState(false);
    const [activityData, setActivityData] = useState([]);

    useEffect(() => {
        if(!targetUser) return;
        let isMounted = true;
        const fetchData = async () => {
            try {
                const myUserSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users/${currentUserId}`));
                if (myUserSnap.exists() && isMounted) {
                     const myFriends = myUserSnap.data().friends || [];
                     setIsFriend(myFriends.some(f => f.uid === targetUser.uid));
                }

                const friendUserSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users/${targetUser.uid}`));
                if(friendUserSnap.exists() && isMounted) {
                    setFriendHallOfFame(friendUserSnap.data().hallOfFame || Array(10).fill(null));
                }

                const friendSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/users/${targetUser.uid}/animeList`));
                if (isMounted) {
                    const friendData = friendSnap.docs.map(d => ({...d.data(), id: d.id}));
                    setList(friendData);
                }

                const mySnap = await getDocs(collection(db, `artifacts/${appId}/public/data/users/${currentUserId}/animeList`));
                if (isMounted) {
                    const myData = mySnap.docs.map(d => ({...d.data(), id: d.id}));
                    setMyList(myData);
                }

                const activityQ = query(collection(db, `artifacts/${appId}/public/data/activity`), where("userId", "==", targetUser.uid), orderBy("timestamp", "desc"), limit(20));
                const activitySnap = await getDocs(activityQ);
                if (isMounted) {
                     setActivityData(activitySnap.docs.map(d => d.data()));
                     setLoading(false);
                }

            } catch (e) {
                console.error(e);
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [db, targetUser, currentUserId]);

    useEffect(() => {
        if (!selectedAnimeKitsuId) return;
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                // If local data exists, prefer it partially? Nah just fetch.
                const res = await fetch(`${KITSU_API_URL}/anime/${selectedAnimeKitsuId}`);
                if (!res.ok) throw new Error("Failed");
                const data = await res.json();
                if (isMounted) setSelectedAnimeData(data.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchDetails();
        return () => { isMounted = false; };
    }, [selectedAnimeKitsuId]);

    const handleFriendAction = async () => {
        try {
            const batch = writeBatch(db);
            const myRef = doc(db, `artifacts/${appId}/public/data/users/${currentUserId}`);
            const theirRef = doc(db, `artifacts/${appId}/public/data/users/${targetUser.uid}`);

            if (isFriend) {
                batch.update(myRef, { friends: arrayRemove({ uid: targetUser.uid, username: targetUser.username }) });
                batch.update(theirRef, { friends: arrayRemove({ uid: currentUserId, username: currentUsername }) });
                await batch.commit();
                setIsFriend(false);
                showToast(`Removed ${targetUser.username} from friends.`, 'success');
            } else {
                batch.update(myRef, { friends: arrayUnion({ uid: targetUser.uid, username: targetUser.username }) });
                batch.update(theirRef, { friends: arrayUnion({ uid: currentUserId, username: currentUsername }) });
                await batch.commit();
                setIsFriend(true);
                showToast(`Added ${targetUser.username} as a friend!`, 'success');
            }
        } catch (e) {
            console.error("Friend action failed", e);
            showToast("Failed to update friend status", 'error');
        }
    };

    const stats = useMemo(() => {
        let totalHours = 0;
        let totalEps = 0;
        let completed = 0;
        let sumScores = 0;
        let ratedCount = 0;
        let unique = new Set();
        list.forEach(a => {
            const eps = a.status === 'completed' && a.totalEpisodes > 0 ? a.totalEpisodes : (a.watchedEpisodes || 0);
            totalEps += eps;
            totalHours += eps * AVG_EPISODE_MINUTES;
            if(a.status === 'completed') {
                completed++;
                unique.add(normalizeTitle(a.title));
            }
            if(a.score > 0) {
                sumScores += a.score;
                ratedCount++;
            }
        });
        
        return { 
            hours: (totalHours/60).toFixed(0), 
            eps: totalEps, 
            completed: unique.size,
            meanScore: ratedCount > 0 ? (sumScores / ratedCount).toFixed(1) : 0
        };
    }, [list]);

    const compatibility = useMemo(() => {
        if (loading || !myList.length || !list.length || targetUser?.uid === currentUserId) return null;
        
        const myIds = new Set(myList.map(a => a.kitsuId));
        const shared = list.filter(a => myIds.has(a.kitsuId));
        
        let scoreDiffSum = 0;
        let scoredCount = 0;
        
        shared.forEach(friendItem => {
             const myItem = myList.find(m => m.kitsuId === friendItem.kitsuId);
             if(friendItem.score > 0 && myItem.score > 0) {
                 scoreDiffSum += Math.abs(friendItem.score - myItem.score);
                 scoredCount++;
             }
        });

        const avgDiff = scoredCount > 0 ? scoreDiffSum / scoredCount : 0;
        const tasteScore = Math.max(0, 100 - (avgDiff * 20));
        
        return {
            sharedCount: shared.length,
            tasteScore: scoredCount > 0 ? tasteScore.toFixed(0) : "N/A",
            sharedList: shared
        };
    }, [list, myList, loading, targetUser, currentUserId]);

    const filtered = list.filter(i => 
        i.status === status && 
        (normalizeTitle(i.title).includes(normalizeTitle(searchQuery)))
    );

    if(!targetUser) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-6 fade-in pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b border-white/10 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button onClick={() => setPage('social')} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors mr-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <h2 className="text-4xl font-black text-white tracking-tighter">{targetUser.username}</h2>
                        {targetUser.uid !== currentUserId && (
                            <button 
                                onClick={handleFriendAction}
                                className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${isFriend ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                            >
                                {isFriend ? 'Following' : 'Follow +'}
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400 uppercase font-bold tracking-wider ml-12">
                        <span>{stats.hours}h Watched</span> • <span>{stats.completed} Completed</span> • <span>{stats.eps} Eps</span> • <span className="text-blue-400">Mean Score: {stats.meanScore}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-white/5 rounded-xl p-1 flex">
                        <button onClick={() => setTab("overview")} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${tab === 'overview' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>Overview</button>
                        <button onClick={() => setTab("library")} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${tab === 'library' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>Library</button>
                        {targetUser.uid !== currentUserId && (
                            <button onClick={() => setTab("compare")} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${tab === 'compare' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>Compare</button>
                        )}
                    </div>
                </div>
            </div>

            {tab === 'overview' && (
                <div className="space-y-6">
                    {/* Stats Panel */}
                    <div className="bg-[#0f111a] border border-white/5 rounded-xl p-8 shadow-xl">
                        <div className="grid grid-cols-3 divide-x divide-white/5">
                            <div className="text-center">
                                <p className="text-3xl font-black text-[#3db4f2] mb-1">{list.length}</p>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Anime</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-black text-[#3db4f2] mb-1">{(stats.hours / 24).toFixed(1)}</p>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Days Watched</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-black text-[#3db4f2] mb-1">{stats.meanScore}</p>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mean Score</p>
                            </div>
                        </div>
                        {/* Progress Bar Visualizer */}
                        <div className="mt-8 relative h-3 bg-white/5 rounded-full overflow-hidden">
                             <div className="absolute top-0 left-0 h-full bg-[#3db4f2] rounded-full" style={{ width: `${Math.min(100, (list.length / 100) * 100)}%` }} />
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-gray-600 font-bold px-1">
                            <span>0</span>
                            <span>50</span>
                            <span>100</span>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none" />
                        <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2 relative z-10"><TrophyIcon /> Hall of Fame</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 relative z-10">
                            {friendHallOfFame.map((item, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => item && setSelectedAnimeKitsuId(item.id)}
                                    className={`aspect-[2/3] rounded-xl border-2 border-dashed ${item ? 'border-transparent shadow-lg cursor-pointer' : 'border-white/5'} flex items-center justify-center relative overflow-hidden bg-black/20 group transition-all`}
                                >
                                    {item ? (
                                        <>
                                            <img src={item.image || "https://placehold.co/200x300?text=?"} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 z-10">
                                                <p className="text-xs font-bold text-white mb-1 leading-tight">{item.title}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Slot {i + 1}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
                        <h3 className="text-xl font-black text-white mb-4">Activity Heatmap</h3>
                        {loading ? <p className="text-gray-500">Loading activity...</p> : <ActivityHeatmap data={activityData} theme={theme} />}
                    </div>

                    <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
                        <h3 className="text-xl font-black text-white mb-4">Recent Activity</h3>
                        <div className="space-y-4">
                            {activityData.slice(0, 5).map((item, idx) => (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={idx} 
                                    className="bg-black/20 border border-white/5 p-4 rounded-2xl flex gap-4 items-center hover:bg-white/5 transition-all group"
                                >
                                    <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white text-lg shadow-lg border border-white/10 overflow-hidden bg-gradient-to-br ${theme.gradient}`}>
                                        {item.username?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-gray-300 text-sm leading-relaxed">
                                            <span className="font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">{item.username}</span> 
                                            <span className="opacity-60 mx-1">{item.context}</span>
                                            <span className={`font-bold ${theme.accentText}`}>{item.animeTitle}</span>
                                        </p>
                                        {item.noteContent && (
                                            <div className="mt-2 bg-black/40 border-l-2 border-white/20 p-2 rounded text-xs text-gray-400 italic">
                                                "{item.noteContent}"
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wider">{item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</p>
                                    </div>
                                    {item.animeImageUrl && (
                                        <img src={item.animeImageUrl} className="w-10 h-14 object-cover rounded-lg shadow-xl border border-white/10 group-hover:scale-105 transition-transform" alt="anime" referrerPolicy="no-referrer" />
                                    )}
                                </motion.div>
                            ))}
                            {activityData.length === 0 && !loading && (
                                <div className="text-center py-10 text-gray-500">No recent activity.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "library" && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center gap-4 border-b border-white/5 pb-4">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {["watching", "completed", "planned", "dropped"].map(s => (
                                <button key={s} onClick={() => setStatus(s)} className={`px-5 py-2 rounded-full text-sm font-bold capitalize transition-all ${status === s ? "bg-white text-black" : "bg-white/5 text-gray-400 hover:text-white"}`}>{s}</button>
                            ))}
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search library..."
                                className="w-48 pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <SearchIcon size={14} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 min-h-[50vh]">
                        {loading && <p className="text-gray-500 col-span-full">Loading library...</p>}
                        {!loading && filtered.map(a => <AnimeCard key={a.id} anime={a} onCardClick={() => setSelectedAnimeKitsuId(a.kitsuId)} viewMode="grid" />)}
                        {!loading && filtered.length === 0 && <p className="col-span-full text-center text-gray-500 py-20 font-medium">No anime found in this category.</p>}
                    </div>
                </div>
            )}

            {tab === "compare" && targetUser.uid !== currentUserId && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 p-8 rounded-3xl border border-white/5 text-center">
                            <p className="text-gray-400 text-xs font-bold uppercase mb-2 tracking-widest">Shared Anime</p>
                            <p className="text-5xl font-black text-white">{compatibility?.sharedCount || 0}</p>
                        </div>
                        <div className="bg-white/5 p-8 rounded-3xl border border-white/5 text-center">
                            <p className="text-gray-400 text-xs font-bold uppercase mb-2 tracking-widest">Taste Match</p>
                            <p className={`text-5xl font-black ${compatibility?.tasteScore !== "N/A" && parseInt(compatibility.tasteScore) > 80 ? "text-green-400" : "text-blue-400"}`}>{compatibility?.tasteScore}%</p>
                        </div>
                    </div>
                    
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2 text-xl"><HeartIcon className="text-red-500" /> Shared Favorites</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {compatibility?.sharedList.length > 0 ? (
                            compatibility.sharedList.map(a => (
                                <div key={a.id}>
                                    <AnimeCard anime={a} onCardClick={() => setSelectedAnimeKitsuId(a.kitsuId)} viewMode="grid" />
                                    <div className="flex justify-between text-xs px-2 mt-2 font-bold bg-white/5 p-2 rounded-lg">
                                        <span className="text-gray-400">Them: <span className="text-white">{a.score || '-'}</span></span>
                                        <span className="text-gray-400">You: <span className="text-white">{myList.find(m => m.kitsuId === a.kitsuId)?.score || '-'}</span></span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm col-span-full">No shared anime found.</p>
                        )}
                    </div>
                </div>
            )}

            {selectedAnimeData && (
                <AnimeDetailsModal 
                    anime={selectedAnimeData} 
                    onClose={() => { setSelectedAnimeData(null); setSelectedAnimeKitsuId(null); }} 
                    db={db} 
                    userId={currentUserId} 
                    ownerId={targetUser.uid}
                    username={currentUsername} 
                />
            )}
        </div>
    );
}