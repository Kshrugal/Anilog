import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
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
  arrayUnion,
  arrayRemove, 
  addDoc,
} from "firebase/firestore";
import { 
    motion, 
    AnimatePresence, 
    LayoutGroup, 
} from "framer-motion";
import { 
  Search as SearchIcon, 
  X as CloseIcon, 
  Star as StarIcon,
  Play as PlayIcon,
  LayoutGrid as ViewGridIcon,
  List as ViewListIcon,
  Trophy as TrophyIcon,
  Calendar as CalendarIcon,
  Dices as DiceIcon,
  Heart as HeartIcon,
  Download as DownloadIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
  Globe as GlobeIcon,
  User as UserIcon,
  Clock3 as ClockIcon,
  Flame as FlameIcon,
  ListChecks as ListChecksIcon,
  ChevronRight as ChevronRightIcon,
  Trash2 as TrashIcon,
  AlertTriangle as AlertTriangleIcon,
  RotateCcw as ResetIcon,
} from 'lucide-react';
import {
  APP_NAME, AVG_EPISODE_MINUTES, KITSU_API_URL, MAJOR_GENRES,
  StarField, THEMES, ThemeContext, appId, auth,
  AnimeCard, AnimeCardSkeleton, AnimeCarousel, AnimeCarouselSkeleton,
  AnimatedCounter, DeciderModal, JournalView, exportUserData,
  fetchMediaDetails, getGreeting, logActivity, normalizeTitle,
} from "../App";
import { getAniListDiscovery, getAniListPersonalized, getAniListSeasonal, getAniListUserAnimeList, searchAniList } from "../services/anilist";

export function AuthPage({ db, setPage, showToast, onContinueGuest }) {
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
        await setDoc(userDocRef, { uid: user.uid, username: username.trim(), createdAt: serverTimestamp(), friends: [] });
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
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-600"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
        <button onClick={onContinueGuest} className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 hover:text-white">
          Explore as Guest
        </button>
      </div>
    </div>
  );
}

export function HomePage({ db, userId, username, showToast }) {
  const { theme, viewMode, setViewMode, setPage } = useContext(ThemeContext);
  const [myList, setMyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("watching");
  const [mediaFilter, setMediaFilter] = useState("all"); // 'all' | 'anime' | 'vn'
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedAnimeKitsuId, setSelectedAnimeKitsuId] = useState(null);
  const [selectedAnimeData, setSelectedAnimeData] = useState(null);
  const [heroAnime, setHeroAnime] = useState(null);
  const [annualGoal, setAnnualGoal] = useState(24);
  
  const [sortBy, setSortBy] = useState("updated");
  const [localQuery, setLocalQuery] = useState("");
  
  // Decider Modal
  const [showDecider, setShowDecider] = useState(false);

  const statusTabs = ["watching", "completed", "planned", "paused", "dropped"];
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
        
        const watching = list
          .filter(a => a.status === 'watching')
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        if (watching.length > 0) {
            setHeroAnime(watching[0]);
        } else {
            setHeroAnime(null);
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
    if (!db || !userId) return;
    getDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}`)).then(snapshot => {
      if (snapshot.exists() && Number(snapshot.data().annualAnimeGoal) > 0) setAnnualGoal(Number(snapshot.data().annualAnimeGoal));
    }).catch(console.error);
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

    if (collectionFilter === 'favorites') filtered = filtered.filter(item => item.favorite);
    if (collectionFilter === 'priority') filtered = filtered.filter(item => item.priority === 'high');
    if (tagFilter !== 'all') filtered = filtered.filter(item => Array.isArray(item.personalTags) && item.personalTags.includes(tagFilter));

    return filtered.sort((a, b) => {
        if (sortBy === 'score') {
            return (b.score || 0) - (a.score || 0);
        } else if (sortBy === 'title') {
            return (a.title || "").localeCompare(b.title || "");
        } else {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        }
    });
  }, [myList, statusFilter, sortBy, localQuery, mediaFilter, collectionFilter, tagFilter]);

  const handleQuickIncrement = async (anime) => {
    if(!db || !userId) return;
    const isVn = anime.mediaType === 'vn' || anime.showType === 'Visual Novel';
    const currentEp = anime.watchedEpisodes || 0;
    const totalEp = anime.totalEpisodes || 0;
    
    if(!isVn && totalEp > 0 && currentEp >= totalEp) return;
    if(isVn && currentEp >= 100) return;

    const newEp = isVn ? Math.min(100, currentEp + 5) : currentEp + 1;
    const isNowComplete = isVn ? newEp >= 100 : totalEp > 0 && newEp >= totalEp;
    const docRef = doc(db, `artifacts/${appId}/public/data/users/${userId}/animeList`, anime.id);
    
    try {
        await updateDoc(docRef, {
          watchedEpisodes: newEp,
          updatedAt: Date.now(),
          ...(isNowComplete ? { status: 'completed', completedAt: new Date().toISOString().slice(0, 10) } : {}),
        });
        logActivity({
            userId, 
            username, 
            type: 'progress', 
            animeTitle: anime.title, 
            animeKitsuId: anime.id, 
            animeImageUrl: anime.imageUrl, 
            context: isVn ? `read ${newEp}% of` : `watched episode ${newEp} of`
        });
        showToast(
          isNowComplete
            ? `${anime.title} completed!`
            : isVn ? `Marked ${newEp}% of ${anime.title}` : `Marked ep ${newEp} of ${anime.title}`,
          'success'
        );
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
  const availableTags = useMemo(() => [...new Set(myList.flatMap(item => Array.isArray(item.personalTags) ? item.personalTags : []))].sort(), [myList]);
  const watchingList = useMemo(() => myList
    .filter(item => item.status === 'watching')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), [myList]);
  const dashboardStats = useMemo(() => {
    const completed = myList.filter(item => item.status === 'completed').length;
    const episodes = myList.reduce((sum, item) => {
      const isVn = item.mediaType === 'vn' || item.showType === 'Visual Novel';
      return sum + (isVn ? 0 : Number(item.watchedEpisodes || 0));
    }, 0);
    const remainingEpisodes = watchingList.reduce((sum, item) => {
      const total = Number(item.totalEpisodes || 0);
      return sum + (total > 0 ? Math.max(0, total - Number(item.watchedEpisodes || 0)) : 0);
    }, 0);
    const activeThisWeek = myList.filter(item => Number(item.updatedAt || 0) > Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const currentYear = String(new Date().getFullYear());
    const completedThisYear = myList.filter(item => item.status === 'completed' && String(item.completedAt || '').startsWith(currentYear)).length;
    return { completed, completedThisYear, episodes, remainingHours: Math.round((remainingEpisodes * AVG_EPISODE_MINUTES) / 60), activeThisWeek };
  }, [myList, watchingList]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.22em] ${theme.accentText}`}>Overview</p>
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{greeting}, {username}</h2>
          <p className="mt-2 text-sm text-gray-500">Pick up where you left off or shape what comes next.</p>
        </div>
        <button onClick={() => setPage('search')} className="group flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
          Add something new <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'In progress', value: watchingList.length, detail: 'current titles', icon: PlayIcon },
          { label: 'Completed', value: dashboardStats.completed, detail: 'all time', icon: ListChecksIcon },
          { label: 'Episodes logged', value: dashboardStats.episodes, detail: 'across your library', icon: FlameIcon },
          { label: 'Queue remaining', value: `${dashboardStats.remainingHours}h`, detail: `${dashboardStats.activeThisWeek} active this week`, icon: ClockIcon },
        ].map(({ label, value, detail, icon: Icon }) => (
          <motion.div key={label} className="group relative overflow-hidden rounded-xl border border-[#262b33] bg-[#12151a] p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
              <Icon className={`h-4 w-4 ${theme.accentText}`} />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{value}</p>
            <p className="mt-1 text-xs text-gray-600">{detail}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[#26332e] bg-[#111916] p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">{new Date().getFullYear()} completion quest</p><p className="mt-1 text-xl font-black text-white">{dashboardStats.completedThisYear} of {annualGoal} anime</p></div><span className="text-sm font-black text-emerald-300">{Math.min(100, Math.round((dashboardStats.completedThisYear / annualGoal) * 100))}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, (dashboardStats.completedThisYear / annualGoal) * 100)}%` }} /></div></div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-gray-500">Goal <input type="number" min="1" max="999" value={annualGoal} onChange={async event => { const next = Math.max(1, Number(event.target.value)); setAnnualGoal(next); await updateDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}`), { annualAnimeGoal: next }); }} className="w-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center font-black text-white" /></label>
      </div>

      {heroAnime && !loading && (
          <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="group relative min-h-[260px] w-full cursor-pointer overflow-hidden rounded-xl border border-[#262b33] bg-[#111419] lg:min-h-[300px]"
              onClick={() => setSelectedAnimeKitsuId(heroAnime.kitsuId)}
          >
              <img src={heroAnime.imageUrl} className="absolute inset-0 h-full w-full object-cover opacity-50 blur-[1px] transition-transform duration-[2s] group-hover:scale-105" alt="" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20"></div>
              <div className="relative flex min-h-[260px] max-w-3xl flex-col justify-end p-6 sm:p-8 lg:min-h-[300px]">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${theme.accentText}`}>
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span> Continue Watching
                  </p>
                  <h3 className="mb-5 line-clamp-2 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{heroAnime.title}</h3>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                          <span className="text-gray-300 text-sm font-bold">Ep {heroAnime.watchedEpisodes} / {heroAnime.totalEpisodes || "?"}</span>
                          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-gray-700/50 backdrop-blur-sm sm:w-56">
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
                          className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black shadow-lg shadow-white/10 transition-shadow hover:shadow-white/20"
                      >
                          <PlayIcon /> Watch Next
                      </motion.button>
                  </div>
              </div>
          </motion.div>
      )}

      {!loading && watchingList.length > 1 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="text-xl font-black text-white">Up next</h3>
              <p className="mt-1 text-xs text-gray-500">Your recently active queue</p>
            </div>
            <button onClick={() => setStatusFilter('watching')} className={`text-xs font-bold ${theme.accentText}`}>View all</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {watchingList.slice(1, 5).map(anime => {
              const progress = Number(anime.watchedEpisodes || 0);
              const total = Number(anime.totalEpisodes || 0);
              return (
                <button key={anime.id} onClick={() => setSelectedAnimeKitsuId(anime.kitsuId)} className="group flex min-w-0 items-center gap-4 rounded-xl border border-[#262b33] bg-[#12151a] p-3 text-left transition-colors hover:bg-[#191d23]">
                  <img src={anime.imageUrl} alt="" className="h-20 w-14 shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">{anime.title}</span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Episode {progress} {total > 0 ? `/ ${total}` : ''}</span>
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10"><span className={`block h-full ${theme.progressbar}`} style={{ width: `${total > 0 ? Math.min(100, (progress / total) * 100) : 0}%` }} /></span>
                  </span>
                  <span onClick={(event) => { event.stopPropagation(); handleQuickIncrement(anime); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-lg font-black text-black transition-transform hover:scale-105">+</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between border-t border-white/5 pt-8">
            <div className="flex overflow-x-auto no-scrollbar gap-2 p-2 -mx-2">
                {statusTabs.map((status) => (
                <motion.button whileTap={{ scale: 0.95 }} key={status} onClick={() => setStatusFilter(status)} className={`px-5 py-2.5 capitalize font-bold rounded-full text-sm transition-all whitespace-nowrap ${statusFilter === status ? "bg-white text-black shadow-lg" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"}`}>
                    {status} <span className={`ml-1 text-[10px] ${statusFilter === status ? 'text-black/50' : 'text-gray-600'}`}>{myList.filter(item => item.status === status).length}</span>
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
        <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            {[{ id: 'all', label: 'Everything' }, { id: 'favorites', label: 'Favorites' }, { id: 'priority', label: 'High priority' }].map(tab => (
                <button key={tab.id} onClick={() => setCollectionFilter(tab.id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${collectionFilter === tab.id ? 'bg-pink-500/20 text-pink-300' : 'text-gray-500 hover:text-white'}`}>{tab.label}</button>
            ))}
        </div>
        {availableTags.length > 0 && <select value={tagFilter} onChange={event => setTagFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#0b0b0d] px-3 py-2 text-xs font-bold text-gray-300"><option value="all">All tags</option>{availableTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}</select>}
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

export function SearchPage({ db, userId, username, onConfetti, showToast, readOnly = false }) {
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
        getAniListDiscovery(10)
            .then(data => { if (isMounted) setTrending(data.trending); })
            .catch(err => console.error('AniList trending error:', err));
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const delayDebounceFn = setTimeout(() => {
            if (isSeasonal) {
                setLoading(true);
                getAniListSeasonal(20)
                    .then(data => {
                        if (isMounted) {
                            setResults(data);
                            setLoading(false);
                        }
                    })
                    .catch(err => {
                        console.error('AniList seasonal error:', err);
                        if (isMounted) { setResults([]); setLoading(false); }
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
                searchAniList(query, 20)
                    .then(data => {
                        if (isMounted) {
                            setResults(data);
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
                        <p className="text-xs text-gray-400">Popular anime from the current AniList season.</p>
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
                    readOnly={readOnly}
                />
            )}
        </div>
    );
}

export function SocialPage({ db, userId, username, showToast, openUserProfile, readOnly = false }) {
    const [feed, setFeed] = useState([]);
    const [users, setUsers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [view, setView] = useState("feed");
    const [composerType, setComposerType] = useState("post");
    const [postText, setPostText] = useState("");
    const [reviewTitle, setReviewTitle] = useState("");
    const [reviewScore, setReviewScore] = useState(0);
    const [posting, setPosting] = useState(false);
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
        if (!db || !userId || readOnly) return;
        const unsubscribe = onSnapshot(doc(db, `artifacts/${appId}/public/data/users/${userId}`), (doc) => {
            if (doc.exists()) {
                setFriends(doc.data().friends || []);
            }
        });
        return () => unsubscribe();
    }, [db, userId, readOnly]);

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

    const publishPost = async () => {
        if (!db || !userId || !postText.trim() || posting) return;
        if (composerType === 'review' && !reviewTitle.trim()) { showToast('Add the anime title for your review.', 'error'); return; }
        setPosting(true);
        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/activity`), {
                userId, username, type: composerType === 'review' ? 'micro_review' : 'text_post',
                context: composerType === 'review' ? `reviewed ${reviewScore ? `${reviewScore}/10` : ''}` : 'posted',
                animeTitle: composerType === 'review' ? reviewTitle.trim() : '',
                noteContent: postText.trim(), timestamp: serverTimestamp(),
            });
            setPostText(''); setReviewTitle(''); setReviewScore(0);
            showToast(composerType === 'review' ? 'Review published!' : 'Post published!', 'success');
        } catch (error) { console.error(error); showToast('Could not publish.', 'error'); }
        setPosting(false);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex space-x-6 border-b border-white/10 pb-4">
                <button onClick={() => setView('feed')} className={`text-2xl font-black transition-colors ${view === 'feed' ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>Activity</button>
                {!readOnly && <button onClick={() => setView('friends')} className={`text-2xl font-black transition-colors ${view === 'friends' ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>My Friends</button>}
                <button onClick={() => setView('search')} className={`text-2xl font-black transition-colors ${view === 'search' ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>Find Users</button>
            </div>

            {view === 'feed' && (
                <div className="space-y-4">
                    {!readOnly && <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                        <div className="mb-4 flex gap-2">{[{ id: 'post', label: 'Post' }, { id: 'review', label: 'Micro-review' }].map(option => <button key={option.id} onClick={() => setComposerType(option.id)} className={`rounded-xl px-4 py-2 text-xs font-black ${composerType === option.id ? 'bg-white text-black' : 'bg-white/5 text-gray-500'}`}>{option.label}</button>)}</div>
                        {composerType === 'review' && <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={reviewTitle} onChange={event => setReviewTitle(event.target.value)} placeholder="Anime title" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /><select value={reviewScore} onChange={event => setReviewScore(Number(event.target.value))} className="rounded-xl border border-white/10 bg-[#0b0b0d] px-4 py-3 text-sm text-white"><option value="0">No score</option>{[10,9,8,7,6,5,4,3,2,1].map(value => <option key={value} value={value}>{value}/10</option>)}</select></div>}
                        <textarea value={postText} onChange={event => setPostText(event.target.value)} maxLength={composerType === 'review' ? 1000 : 500} placeholder={composerType === 'review' ? 'Your spoiler-free quick take…' : 'Share what you are watching or thinking…'} className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white placeholder-gray-600" />
                        <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-gray-600">{postText.length}/{composerType === 'review' ? 1000 : 500}</span><button onClick={publishPost} disabled={!postText.trim() || posting} className={`rounded-xl px-5 py-2 text-xs font-black text-white disabled:opacity-40 ${theme.button}`}>{posting ? 'Publishing…' : 'Publish'}</button></div>
                    </div>}
                    {feed.filter(item => {
                        if (readOnly) return true;
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
                                    <span className="font-bold text-white hover:text-blue-400 transition-colors cursor-pointer" onClick={() => openUserProfile({uid: item.userId, username: item.username})}>{item.username}</span>{' '}
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
                                onClick={() => openUserProfile(friend)}
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
                                onClick={() => openUserProfile(user)}
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

        </div>
    )
}

function AnimeDetailsModal({ anime, onClose, db, userId, ownerId, username, onComplete = undefined, readOnly = false }) {
    const { theme } = useContext(ThemeContext);
    const [status, setStatus] = useState("watching");
    const [episodes, setEpisodes] = useState(0);
    const [score, setScore] = useState(0);
    const [notes, setNotes] = useState("");
    const [favorite, setFavorite] = useState(false);
    const [priority, setPriority] = useState("normal");
    const [repeatCount, setRepeatCount] = useState(0);
    const [startedAt, setStartedAt] = useState("");
    const [completedAt, setCompletedAt] = useState("");
    const [personalTags, setPersonalTags] = useState([]);
    const [tagDraft, setTagDraft] = useState("");
    const [shareNoteActivity, setShareNoteActivity] = useState(true);
    const [loading, setLoading] = useState(false);
    const [existingData, setExistingData] = useState(null);
    const [fetchedGenres, setFetchedGenres] = useState(anime.genres || anime.attributes?.genres || []);
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
    const details = anime.attributes || anime;
    const relatedMedia = details.relations || [];
    const recommendations = details.recommendations || [];
    const anilistCharacters = details.characters || [];
    const streamingLinks = [...(details.streamingEpisodes || []), ...(details.externalLinks || []).filter(link => link.type === 'STREAMING')];
    const kitsuId = anime.kitsuId || anime.id;
    const isVn = anime.mediaType === 'vn' || anime.showType === 'Visual Novel' || anime.attributes?.showType === 'Visual Novel' || String(kitsuId).startsWith('v');
    const isAniList = anime.provider === 'anilist' || anime.attributes?.provider === 'anilist' || String(kitsuId).startsWith('anilist:');
    const isKitsu = (!!anime.attributes || !!anime.canonicalTitle) && !isVn && !isAniList;

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
                    setFavorite(Boolean(data.favorite));
                    setPriority(data.priority || "normal");
                    setRepeatCount(Number(data.repeatCount || 0));
                    setStartedAt(data.startedAt || "");
                    setCompletedAt(data.completedAt || "");
                    setPersonalTags(Array.isArray(data.personalTags) ? data.personalTags : []);
                    setShareNoteActivity(data.shareNoteActivity !== false);
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
            const today = new Date().toISOString().slice(0, 10);
            const resolvedStartedAt = startedAt || (status === 'watching' || status === 'completed' ? today : '');
            const resolvedCompletedAt = completedAt || (status === 'completed' ? today : '');
            const data = {
                kitsuId: String(kitsuId),
                title,
                imageUrl: poster,
                totalEpisodes: totalEps,
                status,
                watchedEpisodes: Number(episodes),
                score: Number(score),
                notes,
                favorite,
                priority,
                repeatCount: Number(repeatCount),
                startedAt: resolvedStartedAt || null,
                completedAt: resolvedCompletedAt || null,
                personalTags,
                shareNoteActivity,
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
                if (existingData.notes !== notes && notes && shareNoteActivity) {
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
        paused: 'bg-orange-500',
        dropped: 'bg-red-500'
    };

    const addTag = () => {
        const cleaned = tagDraft.trim().replace(/^#/, '').slice(0, 24);
        if (!cleaned || personalTags.some(tag => tag.toLowerCase() === cleaned.toLowerCase()) || personalTags.length >= 8) return;
        setPersonalTags(current => [...current, cleaned]);
        setTagDraft('');
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
                            {(details.studios?.length > 0 || details.seasonYear || details.averageRating) && <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                                {details.studios?.[0] && <span><strong className="text-gray-300">Studio</strong> {details.studios[0].name}</span>}
                                {details.seasonYear && <span><strong className="text-gray-300">Season</strong> {details.season} {details.seasonYear}</span>}
                                {details.averageRating && <span><strong className="text-gray-300">Community</strong> {details.averageRating}%</span>}
                                {details.nextAiringEpisode && <span className="text-blue-400"><strong>Episode {details.nextAiringEpisode.episode}</strong> airs in {Math.max(1, Math.ceil(details.nextAiringEpisode.timeUntilAiring / 86400))}d</span>}
                            </div>}
                        </div>

                        {streamingLinks.length > 0 && <div><h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Watch legally</h4><div className="flex flex-wrap gap-2">{streamingLinks.slice(0, 6).map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-white/10">{link.site || link.title || 'Watch'} ↗</a>)}</div></div>}

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

                        {anilistCharacters.length > 0 && (
                            <div>
                                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Characters & cast</h4>
                                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                    {anilistCharacters.map(({ character, voiceActor, role }) => <a key={character.id} href={character.siteUrl} target="_blank" rel="noopener noreferrer" className="w-24 shrink-0 text-center"><img src={character.image?.large} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" referrerPolicy="no-referrer" /><p className="mt-2 line-clamp-1 text-[10px] font-bold text-white">{character.name?.full}</p><p className="line-clamp-1 text-[9px] uppercase text-gray-600">{role}{voiceActor ? ` · ${voiceActor.name?.full}` : ''}</p></a>)}
                                </div>
                            </div>
                        )}

                        {relatedMedia.length > 0 && (
                            <div>
                                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Franchise & related</h4>
                                <div className="grid gap-2 sm:grid-cols-2">{relatedMedia.slice(0, 8).map(({ relationType, media }) => <a key={`${relationType}-${media.id}`} href={media.attributes.siteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:bg-white/10"><img src={media.attributes.posterImage.medium} alt="" className="h-14 w-10 rounded-lg object-cover" /><span className="min-w-0"><span className="block text-[9px] font-black uppercase text-blue-400">{String(relationType).replaceAll('_', ' ')}</span><span className="block truncate text-xs font-bold text-white">{media.attributes.canonicalTitle}</span></span></a>)}</div>
                            </div>
                        )}

                        {recommendations.length > 0 && (
                            <div><h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">You may also like</h4><div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">{recommendations.map(media => <div key={media.id} className="w-24 shrink-0"><img src={media.attributes.posterImage.medium} alt="" className="aspect-[2/3] w-full rounded-xl object-cover" referrerPolicy="no-referrer" /><p className="mt-2 line-clamp-2 text-[10px] font-bold text-white">{media.attributes.canonicalTitle}</p></div>)}</div></div>
                        )}

                        {readOnly ? (
                            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 text-center">
                                <p className="font-bold text-white">Want to add this to your list?</p>
                                <p className="mt-1 text-sm text-gray-400">Sign in or create a free account to track progress, ratings, and notes.</p>
                            </div>
                        ) : isOwner ? (
                            <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                        {['watching', 'completed', 'planned', 'paused', 'dropped'].map(s => (
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

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <button onClick={() => setFavorite(current => !current)} className={`flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${favorite ? 'border-pink-500/30 bg-pink-500/10 text-pink-300' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>
                                        <span><span className="block text-sm font-black">Favorite</span><span className="mt-1 block text-[10px] uppercase tracking-wider opacity-60">Pin to your taste profile</span></span>
                                        <HeartIcon className={`h-5 w-5 ${favorite ? 'fill-current' : ''}`} />
                                    </button>
                                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">Priority</label>
                                        <div className="mt-2 grid grid-cols-3 gap-1">
                                            {['low', 'normal', 'high'].map(level => <button key={level} onClick={() => setPriority(level)} className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase ${priority === level ? 'bg-white text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}>{level}</button>)}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Started</span><input type="date" value={startedAt} onChange={event => setStartedAt(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" /></label>
                                    <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Finished</span><input type="date" value={completedAt} onChange={event => setCompletedAt(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" /></label>
                                    <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Rewatches</span><input type="number" min="0" max="999" value={repeatCount} onChange={event => setRepeatCount(Math.max(0, Number(event.target.value)))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" /></label>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between"><label className="text-xs font-bold uppercase tracking-widest text-gray-500">Personal tags</label><span className="text-[10px] text-gray-600">{personalTags.length}/8</span></div>
                                    <div className="flex gap-2"><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="e.g. comfort watch" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-600" /><button onClick={addTag} className="rounded-xl bg-white/10 px-4 text-xs font-black text-white hover:bg-white/20">Add</button></div>
                                    {personalTags.length > 0 && <div className="flex flex-wrap gap-2">{personalTags.map(tag => <button key={tag} onClick={() => setPersonalTags(current => current.filter(item => item !== tag))} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold text-blue-300">#{tag} ×</button>)}</div>}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Journal note</label><label className="flex cursor-pointer items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={shareNoteActivity} onChange={event => setShareNoteActivity(event.target.checked)} className="accent-blue-500" /> Share update to activity</label></div>
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
export function DiscoveryPage({ db, userId, username, readOnly = false }) {
    const [trending, setTrending] = useState([]);
    const [topAiring, setTopAiring] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [topRated, setTopRated] = useState([]);
    const [personalized, setPersonalized] = useState([]);
    const [tasteGenres, setTasteGenres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnime, setSelectedAnime] = useState(null);
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            try {
                const discovery = await getAniListDiscovery(10);
                let personalResults = [];
                let topTasteGenres = [];
                if (db && userId && !readOnly) {
                    const listSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/users/${userId}/animeList`));
                    const entries: any[] = listSnapshot.docs.map(entryDoc => ({ ...entryDoc.data(), id: entryDoc.id }));
                    const watchedIds = new Set(entries.map(entry => String(entry.kitsuId || entry.id)));
                    const genreScores: Record<string, number> = {};
                    entries.forEach(entry => (entry.genres || []).forEach(genre => {
                        genreScores[genre] = (genreScores[genre] || 0) + Math.max(1, Number(entry.score || 5));
                    }));
                    topTasteGenres = Object.entries(genreScores).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3).map(([genre]) => genre);
                    personalResults = (await getAniListPersonalized(topTasteGenres, 18)).filter(media => !watchedIds.has(String(media.id)));
                }

                if (isMounted) {
                    setTrending(discovery.trending);
                    setTopAiring(discovery.airing);
                    setUpcoming(discovery.upcoming);
                    setTopRated(discovery.rated);
                    setPersonalized(personalResults);
                    setTasteGenres(topTasteGenres);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Discovery fetch error:", err);
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [db, userId, readOnly]);

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

            {personalized.length > 0 && <div className="rounded-[2rem] border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-5 sm:p-7"><div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-400">Your taste, decoded</p><h3 className="mt-2 text-2xl font-black text-white">Made for {username}</h3><p className="mt-1 text-xs text-gray-500">Because you rate {tasteGenres.join(', ')} highly · titles already in your library are hidden</p></div><AnimeCarousel title="Personalized Picks" animeList={personalized} onAnimeClick={setSelectedAnime} isKitsuList={true} /></div>}
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
                    readOnly={readOnly}
                />
            )}
        </div>
    );
}

// --- Grids features removed as requested ---

export function StatsPage({ db, userId, username }) {
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
          const missingGenres = myList.filter(a => !a.genres && a.kitsuId && !String(a.kitsuId).startsWith('anilist:')).slice(0, 3);
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
      } else if (anime.status === 'paused' || anime.status === 'on_hold') {
        onHoldCount++;
      } else if (anime.status === 'dropped') {
        droppedCount++;
      } else if (anime.status === 'planned' || anime.status === 'planning') {
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

function AniListImportPanel({ db, userId, myList, onImported, showToast }) {
  const [anilistUsername, setAniListUsername] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [error, setError] = useState("");
  const [lastImport, setLastImport] = useState(null);

  const existingIds = useMemo(() => new Set(myList.map(item => String(item.kitsuId || item.id))), [myList]);
  const existingTitles = useMemo(() => new Set(myList.map(item => normalizeTitle(item.title || '')).filter(Boolean)), [myList]);
  const importableEntries = useMemo(() => {
    if (!preview) return [];
    return preview.entries.filter(entry => updateExisting || (
      !existingIds.has(String(entry.kitsuId)) && !existingTitles.has(normalizeTitle(entry.title || ''))
    ));
  }, [existingIds, existingTitles, preview, updateExisting]);

  const statusCounts = useMemo(() => {
    if (!preview) return {};
    return preview.entries.reduce((counts, entry) => {
      counts[entry.status] = (counts[entry.status] || 0) + 1;
      return counts;
    }, {});
  }, [preview]);

  const loadPreview = async (event) => {
    event.preventDefault();
    const cleanName = anilistUsername.trim();
    if (!cleanName) return;
    setLoadingPreview(true);
    setError("");
    setPreview(null);
    try {
      const result = await getAniListUserAnimeList(cleanName);
      if (!result.user) throw new Error("AniList user not found or their anime list is private.");
      setPreview(result);
    } catch (importError) {
      console.error("AniList preview failed", importError);
      setError(importError.message || "Could not load that AniList account. Make sure the username and list are public.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const importList = async () => {
    if (!preview || importing || importableEntries.length === 0) return;
    setImporting(true);
    setError("");
    try {
      for (let offset = 0; offset < importableEntries.length; offset += 400) {
        const batch = writeBatch(db);
        importableEntries.slice(offset, offset + 400).forEach(entry => {
          const entryRef = doc(db, `artifacts/${appId}/public/data/users/${userId}/animeList`, String(entry.kitsuId));
          batch.set(entryRef, entry, { merge: true });
        });
        await batch.commit();
      }
      onImported(importableEntries);
      setLastImport({ username: preview.user.name, imported: importableEntries.length, skipped: preview.entries.length - importableEntries.length });
      showToast(`Imported ${importableEntries.length} AniList ${importableEntries.length === 1 ? 'entry' : 'entries'}!`, 'success');
      setPreview(null);
      setAniListUsername("");
    } catch (importError) {
      console.error("AniList import failed", importError);
      setError("The import stopped before completion. Entries already written are safe; you can run it again to continue.");
      showToast("AniList import could not finish.", 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="md:col-span-2 p-8 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent backdrop-blur-xl border border-blue-400/20 rounded-[2rem] shadow-2xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">Move in without starting over</p>
          <h3 className="mt-2 text-2xl font-black text-white">Import from AniList</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">Bring over progress, status, scores, notes, dates, rewatches, formats, and genres from any public AniList anime list.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-400">
          Existing AniLog entries are preserved by default.
        </div>
      </div>

      <form onSubmit={loadPreview} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={anilistUsername}
          onChange={event => setAniListUsername(event.target.value)}
          placeholder="AniList username"
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <button type="submit" disabled={loadingPreview || !anilistUsername.trim()} className="rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          {loadingPreview ? "Checking…" : "Review Import"}
        </button>
      </form>

      {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
      {lastImport && !preview && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200 sm:flex-row sm:items-center sm:justify-between">
          <span><strong>{lastImport.imported}</strong> entries imported from {lastImport.username}.</span>
          <span className="text-xs text-emerald-300/70">{lastImport.skipped} duplicates preserved</span>
        </div>
      )}

      {preview && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-white">{preview.user.name} · {preview.entries.length} anime</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <span key={status} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase text-gray-300">{status}: {String(count)}</span>
                ))}
              </div>
            </div>
            <a href={preview.user.siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-400 hover:text-blue-300">View on AniList ↗</a>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
              <input type="checkbox" checked={updateExisting} onChange={event => setUpdateExisting(event.target.checked)} className="h-4 w-4 accent-blue-500" />
              Overwrite previously imported AniList entries
            </label>
            <span className="whitespace-nowrap text-xs text-gray-500">{preview.entries.length - importableEntries.length} skipped</span>
          </div>

          <button onClick={importList} disabled={importing || importableEntries.length === 0} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-sm font-black text-white shadow-lg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {importing ? "Importing…" : `Import ${importableEntries.length} ${importableEntries.length === 1 ? 'Entry' : 'Entries'}`}
          </button>
        </div>
      )}
    </div>
  );
}

function LibraryResetPanel({ db, userId, username, myList, activityData, onReset, showToast }) {
  const confirmationPhrase = 'DELETE MY LIBRARY';
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [backupReady, setBackupReady] = useState(true);

  const downloadBackup = (activities = activityData) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      username,
      animeList: myList,
      activity: activities,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anilog_${username}_before_reset_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetLibrary = async () => {
    if (confirmation !== confirmationPhrase || isResetting) return;
    setIsResetting(true);
    try {
      const listSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/users/${userId}/animeList`));
      const activitySnapshot = await getDocs(query(collection(db, `artifacts/${appId}/public/data/activity`), where('userId', '==', userId)));
      const fullActivity = activitySnapshot.docs.map(activityDoc => activityDoc.data());

      if (backupReady) downloadBackup(fullActivity);

      const refs = [...listSnapshot.docs, ...activitySnapshot.docs].map(snapshotDoc => snapshotDoc.ref);
      for (let offset = 0; offset < refs.length; offset += 400) {
        const batch = writeBatch(db);
        refs.slice(offset, offset + 400).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      await updateDoc(doc(db, `artifacts/${appId}/public/data/users/${userId}`), { hallOfFame: Array(10).fill(null) });
      onReset();
      setConfirmation('');
      setIsOpen(false);
      showToast(`Library reset complete. ${listSnapshot.size} entries removed.`, 'success');
    } catch (resetError) {
      console.error('Library reset failed', resetError);
      showToast('Library reset could not finish. Please try again.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="p-8 bg-red-500/[0.045] backdrop-blur-xl border border-red-500/20 rounded-[2rem] shadow-2xl">
      <h3 className="text-xl font-black text-white mb-3 flex items-center gap-3">
        <TrashIcon className="text-red-400" size={20} />
        Reset Library
      </h3>
      <p className="text-xs text-gray-400 leading-relaxed font-medium">Remove your anime list, tracking activity, and Hall of Fame while keeping your account, username, and friends. Useful before a clean AniList re-import.</p>
      <button onClick={() => setIsOpen(true)} disabled={myList.length === 0} className="mt-6 w-full py-4 flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-sm font-black text-red-300 uppercase tracking-widest transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40">
        <ResetIcon size={18} /> Reset Tracking Data
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl" onClick={() => !isResetting && setIsOpen(false)}>
          <div className="w-full max-w-lg rounded-[2rem] border border-red-500/25 bg-[#0b0b0d] p-7 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-400"><AlertTriangleIcon /></div>
              <div>
                <h4 className="text-2xl font-black text-white">Start with a clean library?</h4>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">This permanently removes <strong className="text-white">{myList.length} library entries</strong>, your tracking activity, and Hall of Fame. Your account and social connections stay intact.</p>
              </div>
            </div>

            <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              <input type="checkbox" checked={backupReady} onChange={event => setBackupReady(event.target.checked)} className="h-4 w-4 accent-red-500" />
              Download a JSON backup before deleting
            </label>

            <div className="mt-5">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Type {confirmationPhrase} to confirm</label>
              <input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={isResetting} placeholder={confirmationPhrase} className="mt-2 w-full rounded-xl border border-red-500/20 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:ring-2 focus:ring-red-500/40" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setIsOpen(false)} disabled={isResetting} className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-gray-300 hover:bg-white/10">Cancel</button>
              <button onClick={resetLibrary} disabled={confirmation !== confirmationPhrase || isResetting} className="rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">{isResetting ? 'Resetting…' : 'Delete tracking data'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function ProfilePage({ db, userId, currentUser, username, setUsername, showToast, openUserProfile }) {
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
                       onClick={() => openUserProfile({uid: userId, username})}
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
            <AniListImportPanel
              db={db}
              userId={userId}
              myList={myList}
              onImported={(entries) => setMyList(current => {
                const importedIds = new Set(entries.map(entry => String(entry.kitsuId)));
                return [...current.filter(item => !importedIds.has(String(item.kitsuId || item.id))), ...entries];
              })}
              showToast={showToast}
            />
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
                        onClick={() => exportUserData(myList, username, activityData)}
                        className="w-full py-4 flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-black text-white uppercase tracking-widest transition-all"
                    >
                        <DownloadIcon size={18} />
                        Export My Data
                    </motion.button>
                </div>

                <LibraryResetPanel
                    db={db}
                    userId={userId}
                    username={username}
                    myList={myList}
                    activityData={activityData}
                    onReset={() => {
                        setMyList([]);
                        setActivityData([]);
                        setHallOfFame(Array(10).fill(null));
                    }}
                    showToast={showToast}
                />
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
                const apiResults = await searchAniList(query, 15);
                
                const combined = [...localMatches];
                apiResults.forEach(apiItem => {
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

export function UserProfilePage({ db, currentUserId, currentUsername, targetUser, showToast, setPage, readOnly = false }) {
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
                if (!readOnly) {
                    const myUserSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users/${currentUserId}`));
                    if (myUserSnap.exists() && isMounted) {
                        const myFriends = myUserSnap.data().friends || [];
                        setIsFriend(myFriends.some(f => f.uid === targetUser.uid));
                    }
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

                if (!readOnly) {
                    const mySnap = await getDocs(collection(db, `artifacts/${appId}/public/data/users/${currentUserId}/animeList`));
                    if (isMounted) {
                        const myData = mySnap.docs.map(d => ({...d.data(), id: d.id}));
                        setMyList(myData);
                    }
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
    }, [db, targetUser, currentUserId, readOnly]);

    useEffect(() => {
        if (!selectedAnimeKitsuId) return;
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const data = await fetchMediaDetails(selectedAnimeKitsuId);
                if (isMounted) setSelectedAnimeData(data);
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
        const unique = new Set();
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
            hours: Math.round(totalHours / 60),
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
                        {targetUser.uid !== currentUserId && !readOnly && (
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
                    readOnly={readOnly}
                />
            )}
        </div>
    );
}
