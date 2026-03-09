/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './lib/api';
import {
  Search,
  Library,
  History,
  Settings,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ZoomIn,
  Brain,
  Languages,
  ArrowDown,
  Flag,
  RotateCcw,
  CloudUpload,
  Link as LinkIcon,
  Rocket,
  LayoutDashboard,
  TrendingUp,
  Star,
  Eye,
  ExternalLink,
  FileText,
  RefreshCw,
  Menu,
  Zap,
  X,
  CheckCircle,
  AlertCircle,
  Shield,
  Key,
  BookCopy,
  Heart,
  Globe,
  SkipForward,
  Filter,
  Sparkles,
  ScrollText,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  PanelRightClose,
  Play,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { Session, User } from '@supabase/supabase-js';

// --- State Interfaces ---
type View = 'landing' | 'dashboard' | 'reader' | 'library' | 'login' | 'signup' | 'detail' | 'profile' | 'admin' | 'anime' | 'watch';

export interface Manga {
  id: string;
  title: string;
  cover: string;
  description?: string;
  source: string;
  genre: string[];
  rating: number | string;
  status: string;
  isFavorite?: boolean;
}

interface Task {
  id: string;
  title: string;
  chapter: string;
  status: 'Scraping' | 'Cleaning' | 'Translating' | 'Ready';
  progress: number;
  cover: string;
  timeRemaining?: string;
}

interface HistoryItem {
  id: string;
  title: string;
  chapter: string;
  source: string;
  date: string;
  status: string;
  cover: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// --- Toast Component ---
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) => (
  <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl border backdrop-blur-md text-sm font-medium ${t.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-300' :
            t.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
              'bg-primary/10 border-primary/20 text-primary'
            }`}
        >
          {t.type === 'success' ? <CheckCircle size={16} /> : t.type === 'error' ? <AlertCircle size={16} /> : <Zap size={16} />}
          <span>{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// --- Components ---

const Navbar = ({ currentView, setView, onUpload, searchQuery, setSearchQuery, user, role, isAnimeMode, setIsAnimeMode }: {
  currentView: View,
  setView: (v: View) => void,
  onUpload: (files: FileList) => void,
  searchQuery: string,
  setSearchQuery: (q: string) => void,
  user: User | null,
  role: 'user' | 'admin',
  isAnimeMode: boolean,
  setIsAnimeMode: (m: boolean) => void
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  // Only show search on Explore (landing/anime) and Library pages
  const searchAllowed = currentView === 'landing' || currentView === 'library' || currentView === 'anime';

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#191022]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 cursor-pointer shrink-0" 
          onClick={(e) => {
            // Secret Debug Trigger: Click logo 5 times within 3 seconds
            const now = Date.now();
            const last = (window as any)._lastLogoClick || 0;
            const count = (window as any)._logoClickCount || 0;
            if (now - last < 3000) {
              (window as any)._logoClickCount = count + 1;
              if (count + 1 >= 5) {
                alert(`--- DEPLOYMENT DIAGNOSTICS ---\n` +
                      `URL: ${window.location.href}\n` +
                      `window.ENV: ${JSON.stringify(window.ENV, null, 2)}\n` +
                      `Supabase URL: ${((window as any).supabaseDebug?.url || 'Missing')}\n` +
                      `Supabase Key: ${((window as any).supabaseDebug?.keyPresent ? 'Present' : 'Missing')}\n` +
                      `Try visiting /api/health for backend state.`);
                (window as any)._logoClickCount = 0;
              }
            } else {
              (window as any)._logoClickCount = 1;
            }
            (window as any)._lastLogoClick = now;
            setView('landing');
          }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            {isAnimeMode ? <Zap size={20} className="text-[#FF6B6B]" /> : <Languages size={20} />}
          </div>
          <span className="text-xl font-bold tracking-tight text-white hidden sm:block">
            MangaTranslate
          </span>
        </div>

        <div className="flex items-center gap-4 flex-1 justify-end md:justify-center px-4">
          {searchAllowed && (
            <motion.div
              initial={false}
              animate={{ width: isSearchExpanded ? '100%' : '40px' }}
              className="relative max-w-md h-10 flex items-center"
            >
              <button
                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                className={`absolute left-0 z-10 p-2 text-slate-400 hover:text-white transition-colors ${isSearchExpanded ? 'pointer-events-none' : ''}`}
              >
                <Search size={20} />
              </button>
              <AnimatePresence>
                {isSearchExpanded && (
                  <>
                    <motion.input
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: '100%' }}
                      exit={{ opacity: 0, width: 0 }}
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                      placeholder={isAnimeMode ? "Search anime titles..." : "Search manga titles..."}
                      className="w-full bg-background-dark/50 border border-white/10 rounded-full py-2 pl-10 pr-8 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setSearchQuery(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors z-20"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Anime Mode Toggle */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className={`text-xs font-bold transition-colors ${!isAnimeMode ? 'text-primary' : 'text-slate-500'}`}>MANGA</span>
            <button
              onClick={() => {
                setIsAnimeMode(!isAnimeMode);
                setView(!isAnimeMode ? 'anime' : 'landing');
              }}
              className="relative w-12 h-6 rounded-full bg-black/50 border border-white/20 p-1 transition-all"
            >
              <motion.div
                className={`w-4 h-4 rounded-full ${isAnimeMode ? 'bg-[#FF6B6B]' : 'bg-primary'}`}
                animate={{ x: isAnimeMode ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-xs font-bold transition-colors ${isAnimeMode ? 'text-[#FF6B6B]' : 'text-slate-500'}`}>ANIME</span>
          </div>

          <nav className={`flex items-center gap-4 md:gap-6 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
            <button onClick={() => setView('landing')} className={`text-sm font-medium transition-colors ${currentView === 'landing' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Explore</button>
            {user && (
              <>
                <button onClick={() => setView('library')} className={`text-sm font-medium transition-colors ${currentView === 'library' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Library</button>
                {role === 'admin' && (
                  <button onClick={() => setView('admin')} className={`text-sm font-medium transition-colors ${currentView === 'admin' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-emerald-400 hover:text-emerald-300 flex items-center gap-1'}`}><Settings size={14} /> Admin</button>
                )}
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept=".pdf,.zip,.cbz,image/*"
              onChange={(e) => {
                if (e.target.files) {
                  onUpload(e.target.files);
                  setView('dashboard');
                }
              }}
            />
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('profile')}
                className="flex items-center gap-2 h-9 rounded-full bg-white/5 pr-3 pl-1 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors border border-white/10"
              >
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.user_metadata?.username?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </div>
                <span className="hidden sm:block">{user.user_metadata?.username || user.email?.split('@')[0]}</span>
              </button>
              <button
                onClick={() => supabase.auth.signOut().then(() => setView('landing'))}
                className="text-slate-400 hover:text-white transition-colors"
                title="Sign Out"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setView('login')} className="hidden sm:flex h-9 items-center justify-center rounded-lg px-4 text-sm font-bold text-slate-200 hover:bg-white/5 transition-colors">Log In</button>
              <button onClick={() => setView('signup')} className="flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-[0_0_15px_rgba(127,19,236,0.5)] hover:bg-primary/90 transition-all">Sign Up</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const GENRE_LIST = ['Action', 'Adventure', 'Romance', 'Comedy', 'Horror', 'Fantasy', 'Sci-Fi', 'Mystery', 'Drama', 'Historical', 'Psychological', 'Supernatural', 'Slice of Life', 'Sports'];

const LandingPage = ({ setView, searchQuery, onSelectManga, trendingManga, searchResults, onImportUrl, favoriteGenres = [], isAnimeMode = false, setIsAnimeMode }: {
  setView: (v: View) => void,
  searchQuery: string,
  onSelectManga: (m: Manga) => void,
  trendingManga: Manga[],
  searchResults: Manga[],
  onImportUrl: (url: string) => void,
  favoriteGenres?: string[],
  isAnimeMode?: boolean,
  setIsAnimeMode?: (v: boolean) => void
}) => {
  const [heroUrl, setHeroUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [activeGenres, setActiveGenres] = useState<string[]>(favoriteGenres);
  const [filteredManga, setFilteredManga] = useState<Manga[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(favoriteGenres.length > 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageData, setPageData] = useState<Manga[]>([]);
  const [pageLoading, setPageLoading] = useState(false);

  // Fetch paginated trending data
  useEffect(() => {
    if (searchQuery.trim() || activeGenres.length > 0) return; // Skip when searching/filtering
    setPageLoading(true);
    const endpoint = isAnimeMode
      ? `/api/anime/trending?page=${currentPage}`
      : `/api/manga/trending?page=${currentPage}`;
    fetch(endpoint).then(r => r.json()).then(data => {
      if (data?.items) {
        setPageData(data.items);
        setTotalPages(Math.ceil(data.total / data.pageSize));
      } else if (Array.isArray(data)) {
        // Fallback for old response format
        setPageData(data);
        setTotalPages(1);
      }
      setPageLoading(false);
    }).catch(() => setPageLoading(false));
  }, [currentPage, isAnimeMode]);

  // Reset page when switching modes
  useEffect(() => { setCurrentPage(1); }, [isAnimeMode]);

  const displayManga = searchQuery.trim() ? searchResults : (activeGenres.length > 0 ? filteredManga : (pageData.length > 0 ? pageData : trendingManga));

  useEffect(() => {
    if (activeGenres.length === 0) { setFilteredManga([]); return; }
    setFilterLoading(true);
    const endpoint = searchQuery.trim()
      ? `/api/manga/search?q=${encodeURIComponent(searchQuery)}&genres=${encodeURIComponent(activeGenres.join(','))}`
      : `/api/manga/search?genres=${encodeURIComponent(activeGenres.join(','))}`;
    fetch(endpoint).then(r => r.json()).then(data => {
      setFilteredManga(Array.isArray(data) ? data : []);
      setFilterLoading(false);
    }).catch(() => setFilterLoading(false));
  }, [activeGenres, searchQuery]);

  const toggleGenre = (g: string) => {
    setIsPersonalized(false);
    setActiveGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const handleImport = async () => {
    if (!heroUrl.trim()) return;
    setImporting(true);
    await onImportUrl(heroUrl.trim());
    setHeroUrl('');
    setImporting(false);
    setView('dashboard');
  };

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-16">
        <div className="relative overflow-hidden rounded-2xl bg-card-dark shadow-2xl ring-1 ring-white/10">
          <div className="absolute inset-0 z-0">
            <img
              src="https://picsum.photos/seed/manga-bg/1920/1080?blur=10"
              alt="Background"
              className="h-full w-full object-cover opacity-30"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16 text-center sm:px-12 lg:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 backdrop-blur-sm"
            >
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">PaddleOCR · Real-time Translation</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Explore Manga & Anime <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Translated Instantly.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-300"
            >
              Browse thousands of manga with real-time OCR translation powered by PaddleOCR. Read raw manga in your language — no waiting for fan translations.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-10 flex flex-wrap justify-center gap-4"
            >
              <button
                onClick={() => { setIsAnimeMode(false); document.getElementById('browse-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="px-8 py-4 rounded-xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-2 group"
              >
                <BookOpen size={20} className="group-hover:scale-110 transition-transform" />
                Browse Manga
              </button>
              <button
                onClick={() => { setIsAnimeMode(true); document.getElementById('browse-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="px-8 py-4 rounded-xl border-2 border-[#FF6B6B]/50 text-[#FF6B6B] font-bold text-lg hover:bg-[#FF6B6B]/10 transition-all flex items-center gap-2 group"
              >
                <Play size={20} className="group-hover:scale-110 transition-transform" />
                Watch Anime
              </button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 flex justify-center gap-6 text-xs text-slate-500"
            >
              <span className="flex items-center gap-1"><CheckCircle2 size={14} /> PaddleOCR Engine</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Real-time Translation</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Fullscreen Reader</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trending / Browse */}
      <section id="browse-section" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {isPersonalized ? <Sparkles className="text-primary" /> : <TrendingUp className="text-primary" />}
            {searchQuery ? `Search Results for "${searchQuery}"` : isPersonalized ? 'For You ✨' : activeGenres.length > 0 ? `${activeGenres[0]} Manga` : 'Trending Now'}
          </h2>
          {activeGenres.length > 0 && (
            <button onClick={() => { setActiveGenres([]); setIsPersonalized(false); }} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
              <X size={12} /> Clear Filter
            </button>
          )}
        </div>

        {/* Genre Filter Chips — hide in anime mode since Sanka doesn't support genre filtering */}
        {!isAnimeMode && (
          <div className="flex flex-wrap gap-2 mb-6">
            {GENRE_LIST.map(g => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeGenres.includes(g)
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
              >{g}</button>
            ))}
          </div>
        )}

        {displayManga.length > 0 ? (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {displayManga.map((manga) => (
              <motion.div
                key={manga.id}
                whileHover={{ y: -5 }}
                className="group relative flex flex-col gap-3 cursor-pointer"
                onClick={() => onSelectManga(manga)}
              >
                <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-slate-800 shadow-lg relative">
                  <img
                    src={manga.cover}
                    alt={manga.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${manga.id}/400/600`; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <button className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-white shadow-lg">View Details</button>
                  </div>
                  {!isAnimeMode && manga.rating && manga.rating !== '?' && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-xs text-white font-bold flex items-center gap-1">
                      <Star size={12} className="text-yellow-400 fill-yellow-400" /> {manga.rating}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-white leading-tight group-hover:text-primary transition-colors">{manga.title}</h3>
                  {manga.genre && manga.genre.length > 0 && !(manga.genre.length === 1 && manga.genre[0] === 'Anime') && (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      {manga.genre.map(g => <span key={g}>{g}</span>)}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination Bar */}
          {!searchQuery.trim() && activeGenres.length === 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12 mb-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg text-sm font-bold border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >«</button>
              {(() => {
                const pages: (number | string)[] = [];
                const maxVisible = 7;
                if (totalPages <= maxVisible) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('...');
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                  if (currentPage < totalPages - 2) pages.push('...');
                  pages.push(totalPages);
                }
                return pages.map((p, idx) =>
                  typeof p === 'string' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-slate-500 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-10 h-10 rounded-lg text-sm font-bold transition-all border ${
                        p === currentPage
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >{p}</button>
                  )
                );
              })()}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg text-sm font-bold border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >»</button>
            </div>
          )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No manga found matching your search.</p>
          </div>
        )}
      </section>
    </div>
  );
};

const Dashboard = ({ setView, onUpload, tasks, historyList }: { setView: (v: View) => void, onUpload: (files: FileList) => void, tasks: Task[], historyList: HistoryItem[] }) => (
  <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl">
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Import & Scraping Dashboard</h1>
        <p className="text-slate-400 mt-1">Manage your manga uploads, scraping tasks, and translation queue.</p>
      </div>
      <button className="hidden sm:flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
        <Settings size={18} />
        Configure Scrapers
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <div className="lg:col-span-2 space-y-6">
        {/* Dropzone */}
        <div className="rounded-xl bg-card-dark border-2 border-dashed border-white/10 p-8 text-center transition-all hover:border-primary/50 group relative overflow-hidden">
          <input
            type="file"
            multiple
            accept=".pdf,.zip,.cbz,image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(e) => e.target.files && onUpload(e.target.files)}
          />
          <div className="relative z-0 flex flex-col items-center justify-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
              <CloudUpload size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Drop your local files here</h3>
              <p className="text-sm text-slate-400 mt-1">Supports PDF, ZIP, CBZ, Images (Max 500MB)</p>
            </div>
            <div className="flex items-center gap-3 w-full justify-center">
              <div className="h-[1px] bg-white/10 w-24"></div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Or</span>
              <div className="h-[1px] bg-white/10 w-24"></div>
            </div>
            <button className="rounded-lg bg-white/5 px-6 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors">
              Browse Files
            </button>
          </div>
        </div>

        {/* URL Import */}
        <div className="rounded-xl bg-card-dark border border-white/5 p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="text-purple-400" size={20} />
            <h3 className="text-lg font-bold text-white">Import via URL</h3>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <input
                className="w-full bg-background-dark border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary outline-none"
                placeholder="https://mangadex.org/title/..."
                type="text"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Chapter Range</label>
                <div className="flex items-center gap-2">
                  <input className="w-full bg-background-dark border border-white/10 rounded-lg py-2 px-3 text-white text-sm" placeholder="Start" type="number" />
                  <span className="text-slate-500">-</span>
                  <input className="w-full bg-background-dark border border-white/10 rounded-lg py-2 px-3 text-white text-sm" placeholder="End" type="number" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Language Target</label>
                <select className="w-full bg-background-dark border border-white/10 rounded-lg py-2 px-3 text-white text-sm outline-none">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
            </div>
            <button className="w-full mt-2 bg-gradient-to-r from-primary to-purple-500 text-white font-bold py-3 rounded-lg shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
              <Rocket size={18} />
              Start Batch Import
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="rounded-xl bg-card-dark border border-white/5 h-full flex flex-col">
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              Active Tasks
            </h3>
            <span className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-1 rounded">3 Running</span>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[600px] custom-scrollbar">
            {tasks.map(task => (
              <div key={task.id} className="bg-card-darker rounded-lg p-3 border border-white/5 hover:border-primary/30 transition-colors">
                <div className="flex gap-3">
                  <div className="w-16 h-20 bg-slate-800 rounded overflow-hidden flex-shrink-0">
                    <img src={task.cover} alt="" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${task.status === 'Scraping' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
                        task.status === 'Cleaning' ? 'text-primary bg-primary/10 border-primary/20' :
                          task.status === 'Ready' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
                            'text-purple-400 bg-purple-400/10 border-purple-400/20'
                        }`}>{task.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{task.chapter}</p>
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>{task.status === 'Scraping' ? 'Assets Downloaded' : task.status === 'Cleaning' ? 'Removing Text' : 'AI Translation'}</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }}></div>
                      </div>
                      <div className="flex justify-end mt-1">
                        <span className="text-[10px] text-slate-500">~{task.timeRemaining} remaining</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* History Table */}
    <div className="rounded-xl bg-card-dark border border-white/5 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Recent Scraping History</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="bg-background-dark border border-white/10 rounded-lg py-1.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none" placeholder="Search..." type="text" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-white/5 text-xs uppercase text-slate-300">
            <tr>
              <th className="px-6 py-3 font-semibold">Manga</th>
              <th className="px-6 py-3 font-semibold">Source</th>
              <th className="px-6 py-3 font-semibold">Date</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {historyList.map(item => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={item.cover} alt="" className="h-10 w-8 rounded object-cover" referrerPolicy="no-referrer" />
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="text-xs">{item.chapter}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={14} />
                    {item.source}
                  </div>
                </td>
                <td className="px-6 py-4">{item.date}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${item.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {item.status === 'Completed' ? (
                      <>
                        <button onClick={() => setView('reader')} className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                          Open Reader
                        </button>
                        <button className="rounded-lg bg-white/5 px-2 py-1.5 text-slate-300 hover:bg-white/10 transition-colors">
                          <FileText size={16} />
                        </button>
                      </>
                    ) : (
                      <button className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 flex items-center gap-1">
                        <RefreshCw size={14} /> Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const LibraryPage = ({ setView, onSelectManga, user, session }: { setView: (v: View) => void, onSelectManga: (m: Manga) => void, user: User | null, session: any }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'favourites'>('all');
  const [libraryManga, setLibraryManga] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [libSearch, setLibSearch] = useState('');

  const fetchLibrary = async () => {
    if (!user || !session?.access_token) return;
    setLoading(true);
    const headers: Record<string, string> = { 'Authorization': `Bearer ${session.access_token}` };
    const res = await fetch(`${API_BASE_URL}/api/library`, { headers });
    const data = await res.json();
    if (Array.isArray(data)) setLibraryManga(data);
    setLoading(false);
  };

  useEffect(() => { fetchLibrary(); }, [user, session]);

  const handleToggleFavorite = async (e: React.MouseEvent, manga: Manga) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    const newFav = !manga.isFavorite;
    setLibraryManga(prev => prev.map(m => m.id === manga.id ? { ...m, isFavorite: newFav } : m));
    
    const headers: Record<string, string> = { 
        'Authorization': `Bearer ${session.access_token}`, 
        'Content-Type': 'application/json' 
    };
    
    await fetch(`${API_BASE_URL}/api/library/${manga.id}/favorite`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isFavorite: newFav })
    });
  };

  const handleRemove = async (e: React.MouseEvent, mangaId: string) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    setLibraryManga(prev => prev.filter(m => m.id !== mangaId));
    
    const headers: Record<string, string> = { 'Authorization': `Bearer ${session.access_token}` };
    await fetch(`${API_BASE_URL}/api/library/${mangaId}`, { 
        method: 'DELETE', 
        headers 
    });
  };

  const displayed = libraryManga
    .filter(m => activeTab === 'favourites' ? m.isFavorite : true)
    .filter(m => !libSearch || m.title.toLowerCase().includes(libSearch.toLowerCase()));

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Personal Library</h1>
          <p className="text-slate-400 mt-2">{libraryManga.length} manga saved · {libraryManga.filter(m => m.isFavorite).length} favourites</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Library search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={libSearch}
              onChange={e => setLibSearch(e.target.value)}
              placeholder="Search library..."
              className="bg-card-dark border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-white focus:ring-2 focus:ring-primary outline-none w-44"
            />
          </div>
          <div className="flex bg-card-dark p-1 rounded-xl border border-white/10">
            {(['all', 'favourites'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${activeTab === tab ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                {tab === 'favourites' && <Heart size={14} className={activeTab === 'favourites' ? 'fill-white' : ''} />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-slate-400 animate-pulse">Scanning your bookshelves...</p>
        </div>
      ) : displayed.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {displayed.map((manga) => (
            <motion.div
              key={manga.id}
              whileHover={{ y: -8 }}
              className="group cursor-pointer relative"
              onClick={() => onSelectManga(manga)}
            >
              <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl bg-slate-800 shadow-xl relative border border-white/5">
                <img src={manga.cover} alt={manga.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${manga.id}/400/600`; }} />
                {/* Favourite toggle */}
                <button
                  onClick={(e) => handleToggleFavorite(e, manga)}
                  className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-md transition-all ${manga.isFavorite ? 'bg-red-500/80 text-white' : 'bg-black/50 text-slate-400 opacity-0 group-hover:opacity-100'}`}
                >
                  <Heart size={12} className={manga.isFavorite ? 'fill-white' : ''} />
                </button>
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemove(e, manga.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-slate-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
              <h3 className="mt-3 font-bold text-white text-sm line-clamp-1 group-hover:text-primary transition-colors">{manga.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{manga.rating} ★ · {manga.status}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-40 bg-card-dark rounded-3xl border border-white/5 border-dashed">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-slate-600 mb-6">
            {activeTab === 'favourites' ? <Heart size={40} /> : <BookCopy size={40} />}
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{activeTab === 'favourites' ? 'No favourites yet' : 'Your library is empty'}</h2>
          <p className="text-slate-400 mb-8 max-w-sm mx-auto">{activeTab === 'favourites' ? 'Heart a manga in your library to add it to favourites.' : 'Start exploring and add manga to your personal collection.'}</p>
          <button onClick={() => setView('landing')} className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/20">
            Explore Trending Manga
          </button>
        </div>
      )}
    </div>
  );
};

const MangaDetailPage = ({ manga, setView, onAddToLibrary, source, setSource, setWatchQuery }: { manga: Manga, setView: (v: View) => void, onAddToLibrary: (m: Manga) => void, source: 'mangadex' | 'mangabuddy', setSource: (s: 'mangadex' | 'mangabuddy') => void, setWatchQuery: (q: string) => void }) => {
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleWatchAnime = async () => {
    if (!manga?.title) return;
    try {
      const sanitizedTitle = manga.title.replace(/[^a-zA-Z0-9\s\-:]/g, ' ').replace(/\s+/g, ' ').trim();
      const res = await fetch(`${API_BASE_URL}/api/anime/search?q=${encodeURIComponent(sanitizedTitle)}`);
      const payload = await res.json();

      if (payload && payload.length > 0) {
        setWatchQuery(payload[0].animeId);
        setView('watch');
      } else {
        alert("No Anime adaptation found for this title.");
      }
    } catch (e) {
      alert("Network Error checking Anime DB.");
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 mx-auto max-w-5xl">
      <button
        onClick={() => setView('landing')}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Explore
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
          >
            <img src={manga.cover} alt={manga.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${manga.id}/400/600`; }} />
          </motion.div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">{manga.title}</h1>
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <div className="flex items-center gap-1 text-yellow-400">
                <Star size={16} fill="currentColor" />
                <span className="font-bold">{manga.rating}</span>
              </div>
              <span className="text-slate-500">•</span>
              <span className="text-primary font-bold">{manga.status}</span>
              <span className="text-slate-500">•</span>
              <div className="flex gap-2">
                {manga.genre.map(g => (
                  <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card-dark border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-2 text-primary mb-4">
              <BookOpen size={20} className={loading ? 'animate-pulse' : ''} />
              <h3 className="font-bold uppercase tracking-wider text-sm">Description</h3>
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="h-4 bg-white/5 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded w-4/6 animate-pulse"></div>
              </div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-slate-300 leading-relaxed"
              >
                {manga.description || 'No description available for this manga.'}
              </motion.p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setView('reader')}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 group"
            >
              <BookOpen size={20} className="group-hover:scale-110 transition-transform" />
              Start Reading
            </button>
            <button
              onClick={() => onAddToLibrary(manga)}
              className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <Library size={20} />
              Library
            </button>
            <button
              onClick={handleWatchAnime}
              className="px-6 bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-[#FF6B6B] font-bold py-4 rounded-xl hover:bg-[#FF6B6B]/20 transition-colors flex items-center justify-center gap-2 group"
            >
              <Zap size={20} className="group-hover:scale-110 transition-transform" />
              Watch Anime
            </button>
          </div>



          <div className="p-4 rounded-2xl bg-card-dark border border-white/5 space-y-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Choose Provider Source</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'mangadex', name: 'MangaDex', icon: <Zap size={14} /> },
                { id: 'mangabuddy', name: 'MangaBuddy', icon: <Search size={14} /> }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id as any)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${source === s.id ? 'bg-primary/20 border-primary text-white ring-1 ring-primary/30' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                >
                  {s.icon}
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginPage = ({ setView }: { setView: (v: View) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setView('landing');
    }
  };

  return (
    <div className="pt-32 pb-12 px-4 flex justify-center items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card-dark border border-white/10 rounded-2xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary mb-4">
            <Languages size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-slate-400 mt-2">Log in to your MangaTranslate account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          <button disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:bg-primary/90 transition-all mt-6 disabled:opacity-50">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-sm text-slate-400">
            Don't have an account?{' '}
            <button onClick={() => setView('signup')} className="text-primary font-bold hover:text-white transition-colors">Sign Up</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const SignupPage = ({ setView }: { setView: (v: View) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: `${firstName} ${lastName}`.trim() } }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessMsg('Account created successfully! Please check your email inbox to confirm your account before logging in.');
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-12 px-4 flex justify-center items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card-dark border border-white/10 rounded-2xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary mb-4">
            <Languages size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white">Create Account</h2>
          <p className="text-slate-400 mt-2">Start your journey with MangaTranslate</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg flex items-center gap-2">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSignup}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Doe"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <p className="text-[10px] text-slate-500 text-center px-4">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
          <button onClick={() => setView('login')} disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:bg-primary/90 transition-all mt-6 disabled:opacity-50">
            {loading ? 'Creating Account...' : (successMsg ? 'Go to Login' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <button onClick={() => setView('login')} className="text-primary font-bold hover:text-white transition-colors">Log In</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Indonesian', 'Malay', 'Thai', 'Vietnamese', 'Dutch', 'Polish', 'Russian', 'Arabic', 'Turkish'];

const Reader = ({ setView, manga, session, source }: { setView: (v: View) => void, manga: Manga | null, session: any, source: 'mangadex' | 'mangabuddy' }) => {
  const [chapters, setChapters] = useState<any[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [translations, setTranslations] = useState<any[]>([]);
  const [overlayActive, setOverlayActive] = useState(true);
  const [translationEnabled, setTranslationEnabled] = useState(true);
  const [statusText, setStatusText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<string>(() => localStorage.getItem('manga_target_lang') || 'English');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [endOfChapter, setEndOfChapter] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<number | null>(null);
  const [showScript, setShowScript] = useState(true);
  const [ocrLanguage, setOcrLanguage] = useState<string>('japan'); // Default to PaddleOCR japan model identifier
  const [imageScale, setImageScale] = useState({ w: 800, h: 1200 });
  const progressTimerRef = React.useRef<any>(null);

  // Fullscreen reader state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsTranscript, setShowFsTranscript] = useState(false);
  const [fsControlsVisible, setFsControlsVisible] = useState(true);
  const fsControlsTimer = React.useRef<any>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // Load chapters, then restore progress
  useEffect(() => {
    if (!manga) return;
    setStatusText('Fetching chapters...');
    const loadChapters = async () => {
      try {
        // Pass manga title so the backend can resolve stale/wrong IDs via MangaDex title search
        let data = await fetch(`${API_BASE_URL}/api/manga/${manga.id}/chapters?title=${encodeURIComponent(manga.title)}&source=${source}`).then(res => res.json());

        // Fallback: If MangaDex API blocked the feed, use our backend scraper
        if (!data || data.length === 0) {
          setStatusText('API Blocked. Scraping alternate sources...');
          // Pass manga title directly — MangaDex blocks metadata fetches for licensed titles
          data = await fetch(`${API_BASE_URL}/api/scrape/chapters?title=${encodeURIComponent(manga.title)}`).then(r => r.json());

          if (!data || data.length === 0) {
            setStatusText('No chapters available for this manga.');
            return;
          }

          // Remap scraper data to match MangaDex expected schema so UI doesn't crash
          data = data.map((c: any, index: number) => ({
            id: c.url, // Scraper URL used as ID
            attributes: {
              chapter: c.chapter || (data.length - index).toString(),
              title: c.title || `Chapter ${c.chapter}`,
              translatedLanguage: 'en'
            }
          }));
        }

        setChapters(data);
        // Restore progress
        let startChIdx = 0;
        let startPage = 0;
        if (session?.access_token) {
          try {
            const p = await fetch(`${API_BASE_URL}/api/progress/${manga.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json());
            if (p?.chapter_id) {
              const idx = data.findIndex((c: any) => c.id === p.chapter_id);
              if (idx >= 0) { startChIdx = idx; startPage = p.page_index || 0; }
            }
          } catch (_) { }
        }
        setChapterIndex(startChIdx);
        setCurrentChapter(data[startChIdx]);
        setCurrentPage(startPage);
      } catch (err) {
        console.error(err);
        setStatusText('Failed to load chapters.');
      }
    };
    loadChapters();
  }, [manga, source]);

  // Load pages when chapter changes
  useEffect(() => {
    if (!currentChapter) return;
    setPages([]);
    setCurrentPage(0);
    setStatusText('Loading pages...');

    // If chapter.id is a URL (from scraper fallback), use the scraper pages endpoint
    const chapterId = currentChapter.id;
    fetch(`${API_BASE_URL}/api/manga/chapter/${encodeURIComponent(chapterId)}/pages?source=${source}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (data && data.length > 0) {
          // Always route images through Node to spoof the referer and bypass CORS/403 Forbidden
          setPages(data.map(url => `${API_BASE_URL}/api/manga/image-proxy?url=${encodeURIComponent(url)}`));
          setStatusText('');
        } else {
          setStatusText('No pages found for this chapter.');
        }
      }).catch(() => setStatusText('Failed to load pages.'));
  }, [currentChapter]);

  // Save progress
  useEffect(() => {
    if (!manga || !currentChapter || pages.length === 0) return;
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(() => {
      if (session?.access_token) {
        const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
        fetch(`${API_BASE_URL}/api/progress`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ mangaId: manga.id, mangaTitle: manga.title, chapterId: currentChapter.id, chapterNumber: currentChapter.chapter, pageIndex: currentPage, totalPages: pages.length })
        }).catch(() => { });
      }
      // Check end of chapter
      setEndOfChapter(currentPage === pages.length - 1);
    }, 800);

    // Clear translations immediately when page or chapter changes to prevent leakage
    setTranslations([]);
    setStatusText('');

    return () => clearTimeout(progressTimerRef.current);
  }, [currentPage, currentChapter, pages.length]);

  // Translate current page
  useEffect(() => {
    if (!manga || pages.length === 0 || !translationEnabled) {
      setTranslations([]);
      return;
    }

    let isAborted = false;

    const translatePage = async () => {
      setOverlayActive(true);
      setOcrProgress(0);
      setStatusText('Extracting text (PaddleOCR AI)...');

      try {
        let prog = 0;
        const progInterval = setInterval(() => {
          prog = Math.min(95, prog + Math.random() * 15);
          setOcrProgress(Math.floor(prog));
        }, 400);

        // Unwrap proxy URL back to original for OCR (Python needs a real http URL)
        let ocrUrl = pages[currentPage];
        const proxyMatch = ocrUrl.match(/\/api\/manga\/image-proxy\?url=(.*)/);
        if (proxyMatch && proxyMatch[1]) {
          ocrUrl = decodeURIComponent(proxyMatch[1]);
        }

        const ocrRes = await fetch(`${API_BASE_URL}/api/ai/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: ocrUrl,
            lang: ocrLanguage
          })
        });

        clearInterval(progInterval);
        setOcrProgress(100);

        if (isAborted) return;
        if (!ocrRes.ok) throw new Error('OCR failed');

        const { blocks, error } = await ocrRes.json();
        if (error) throw new Error(error);

        if (!blocks || blocks.length === 0) {
          setStatusText('');
          setTranslations([]);
          return;
        }

        setStatusText('Translating Script...');
        const transRes = await fetch(`${API_BASE_URL}/api/ai/translate-only`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: blocks.map(b => b.text),
            targetLanguage,
            sourceLanguage: ocrLanguage // Explicitly pass the OCR language as source
          })
        });

        if (isAborted) return;
        if (!transRes.ok) throw new Error('Translation failed');

        const { translations: translatedList } = await transRes.json();

        const finalTranslations = blocks.map((b, i) => ({
          id: i + 1,
          original: b.text,
          translated: translatedList[i] || b.text,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height
        }));

        setTranslations(finalTranslations);
        setStatusText('');
      } catch (err: any) {
        if (!isAborted) {
          console.error('[TranslatePage] Error:', err);
          setStatusText('⚠️ Error: ' + err.message);
        }
      }
    };

    translatePage();
    return () => { isAborted = true; };
  }, [pages, currentPage, manga, targetLanguage, translationEnabled, refreshTrigger, ocrLanguage]);

  const isTranslating = statusText && !statusText.includes('Ready') && statusText !== '';

  const checkNavigation = () => {
    // Automatically cut off/clean up is handled by useEffect dependency changes
    return true;
  };

  const goNextChapter = () => {
    if (!checkNavigation()) return;
    if (chapterIndex < chapters.length - 1) {
      const next = chapterIndex + 1;
      setChapterIndex(next);
      setCurrentChapter(chapters[next]);
      setCurrentPage(0);
      setEndOfChapter(false);
    }
  };
  const goPrevChapter = () => {
    if (!checkNavigation()) return;
    if (chapterIndex > 0) {
      const prev = chapterIndex - 1;
      setChapterIndex(prev);
      setCurrentChapter(chapters[prev]);
      setCurrentPage(0);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (!checkNavigation()) return;
    setCurrentPage(newPage);
  };

  // Fullscreen keyboard handler
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsFullscreen(false); return; }
      if (e.key === 'ArrowRight' || e.key === 'd') handlePageChange(Math.min(pages.length - 1, currentPage + 1));
      if (e.key === 'ArrowLeft' || e.key === 'a') handlePageChange(Math.max(0, currentPage - 1));
      // Show controls briefly on any keypress
      setFsControlsVisible(true);
      if (fsControlsTimer.current) clearTimeout(fsControlsTimer.current);
      fsControlsTimer.current = setTimeout(() => setFsControlsVisible(false), 3000);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, currentPage, pages.length]);

  // Auto-hide fullscreen controls after 3s
  useEffect(() => {
    if (!isFullscreen) return;
    setFsControlsVisible(true);
    fsControlsTimer.current = setTimeout(() => setFsControlsVisible(false), 3000);
    return () => { if (fsControlsTimer.current) clearTimeout(fsControlsTimer.current); };
  }, [isFullscreen]);

  const handleFsTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleFsTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handlePageChange(Math.min(pages.length - 1, currentPage + 1));
      else handlePageChange(Math.max(0, currentPage - 1));
    }
    touchStartRef.current = null;
  };

  const handleFsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.35) handlePageChange(Math.max(0, currentPage - 1));
    else if (x > 0.65) handlePageChange(Math.min(pages.length - 1, currentPage + 1));
    else {
      setFsControlsVisible(v => !v);
      if (fsControlsTimer.current) clearTimeout(fsControlsTimer.current);
    }
  };

  const handleLangChange = (lang: string) => {
    setTargetLanguage(lang);
    localStorage.setItem('manga_target_lang', lang);
    setShowLangPicker(false);
  };


  return (
    <div className="flex h-screen overflow-hidden pt-16">
      {/* Left Sidebar */}
      <aside className="w-72 bg-surface-dark border-r border-white/10 flex flex-col shrink-0 hidden md:flex">
        <div className="p-5 border-b border-white/10">
          <button onClick={() => setView('detail')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors text-sm">
            <ChevronLeft size={16} /> Back to Manga
          </button>
          <h2 className="text-white text-lg font-bold mb-1 line-clamp-1">{manga?.title || 'Unknown Manga'}</h2>
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <BookOpen size={14} />
            <span>{currentChapter ? `Ch ${currentChapter.chapter}` : 'Loading...'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 mb-1">Chapters</div>
          {chapters.map(ch => (
            <button
              key={ch.id}
              onClick={() => {
                if (!checkNavigation()) return;
                setCurrentChapter(ch);
              }}
              className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-colors border ${currentChapter?.id === ch.id
                ? 'bg-primary/20 border-primary/30 group'
                : 'hover:bg-card-dark border-transparent'
                }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-medium ${currentChapter?.id === ch.id ? 'text-white font-bold' : 'text-gray-300'}`}>Ch {ch.chapter || '?'}</span>
                <span className={`text-xs ${currentChapter?.id === ch.id ? 'text-primary/80' : 'text-gray-500'}`}>{ch.title || 'Chapter Title'}</span>
              </div>
              {currentChapter?.id === ch.id ? <Eye size={16} className="text-primary" /> : null}
            </button>
          ))}
        </div>

        <div className="h-32 bg-background-dark border-t border-white/10 p-4 shrink-0">
          <div className="text-xs font-bold text-gray-400 mb-2 flex justify-between">
            <span>Page {pages.length ? currentPage + 1 : 0} / {pages.length}</span>
            <span>{pages.length ? Math.round(((currentPage + 1) / pages.length) * 100) : 0}%</span>
          </div>
          <div className="flex gap-0.5 h-12 items-end">
            {[0.4, 0.4, 0.4, 1, 0.75, 0.75].map((h, i) => (
              <div key={i} className={`flex-1 rounded-sm ${i === 3 ? 'bg-primary ring-2 ring-white/20' : i < 3 ? 'bg-primary/40' : 'bg-card-dark'}`} style={{ height: `${h * 100}%` }}></div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Viewer */}
      <section className="flex-1 bg-background-dark relative overflow-y-auto flex justify-center custom-scrollbar">
        <div className="w-full max-w-4xl py-8 px-4 md:px-0 flex flex-col gap-4 items-center">
          <div className="relative inline-block shadow-2xl rounded-sm overflow-hidden bg-surface-dark">
            {pages.length > 0 ? (
              <img
                src={pages[currentPage]}
                alt="Manga Page"
                className="max-w-full max-h-[85vh] object-contain block"
                referrerPolicy="no-referrer"
                loading="eager"
                onLoad={(e) => setImageScale({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
            ) : (
              <div className="text-slate-500 flex flex-col items-center py-32">
                <RefreshCw size={32} className="animate-spin mb-4 text-primary" />
                <p>Analyzing Page Layout...</p>
              </div>
            )}

            {/* Script Markers */}
            {overlayActive && pages.length > 0 && translations.map((t, idx) => {
              const left = (t.x / imageScale.w) * 100;
              const top = (t.y / imageScale.h) * 100;
              const isHovered = hoveredMarkerId === t.id;

              return (
                <motion.div
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{
                    scale: 1,
                    boxShadow: isHovered ? '0 0 20px #7c3aed, 0 0 40px #7c3aed' : 'none',
                    backgroundColor: isHovered ? '#7c3aed' : 'rgba(124, 58, 237, 0.8)'
                  }}
                  style={{ top: `${top}%`, left: `${left}%` }}
                  onMouseEnter={() => setHoveredMarkerId(t.id)}
                  onMouseLeave={() => setHoveredMarkerId(null)}
                  className="absolute z-20 w-5 h-5 -ml-2.5 -mt-2.5 flex items-center justify-center rounded-full text-[10px] font-black text-white cursor-help border-2 border-white/50 backdrop-blur-sm"
                >
                  {t.id}
                </motion.div>
              );
            })}
          </div>

          <div className="sticky bottom-6 flex items-center gap-2 bg-surface-dark/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-2xl z-30 flex-wrap justify-center">
            <button onClick={goPrevChapter} disabled={chapterIndex === 0} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors disabled:opacity-30 flex items-center text-[11px] font-bold"><ChevronLeft size={14} />Ch</button>
            <button onClick={() => handlePageChange(0)} disabled={currentPage === 0} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors disabled:opacity-30"><ChevronsLeft size={20} /></button>
            <button onClick={() => handlePageChange(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors disabled:opacity-30"><ChevronLeft size={20} /></button>
            <span className="text-xs font-bold text-white px-2 whitespace-nowrap">Ch {currentChapter?.chapter || '?'} · {pages.length ? currentPage + 1 : 0}/{pages.length}</span>
            <button onClick={() => handlePageChange(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors disabled:opacity-30"><ChevronRight size={20} /></button>
            <button onClick={goNextChapter} disabled={chapterIndex >= chapters.length - 1} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors disabled:opacity-30 flex items-center text-[11px] font-bold">Ch<ChevronRight size={14} /></button>
            <div className="h-6 w-px bg-white/10 mx-1" />
            <button onClick={() => setOverlayActive(!overlayActive)} className={`p-2 hover:bg-white/5 rounded-full transition-colors ${overlayActive ? 'text-primary' : 'text-slate-400'}`}><Brain size={20} /></button>
            <div className="h-6 w-px bg-white/10 mx-1" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <Globe size={14} className="text-primary" />
              <span className="text-[11px] font-bold text-white">{targetLanguage}</span>
            </div>
            <div className="h-6 w-px bg-white/10 mx-1" />
            <button onClick={() => setIsFullscreen(true)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors" title="Fullscreen Reader">
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Right Sidebar */}
      <aside className="w-80 bg-surface-dark border-l border-white/10 flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Brain size={18} className="animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Neural Translate</h2>
          </div>
          <p className="text-xs text-gray-500">Real-time text replacement active</p>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Translation Pipeline</label>
              <button
                onClick={() => setTranslationEnabled(!translationEnabled)}
                className={`w-10 h-5 rounded-full relative transition-colors ${translationEnabled ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${translationEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>

            <div className={`flex flex-col gap-4 transition-all ${translationEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              {/* Language Configuration (Collapsible) */}
              <div className="rounded-xl bg-card-dark border border-white/10 overflow-hidden">
                <button
                  onClick={() => setShowLangPicker(!showLangPicker)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-primary" />
                    <span className="text-xs font-bold text-white">Target: {targetLanguage}</span>
                  </div>
                  <ArrowDown size={14} className={`text-gray-500 transition-transform ${showLangPicker ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showLangPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-surface-dark px-1 py-1 max-h-48 overflow-y-auto"
                    >
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang}
                            onClick={() => handleLangChange(lang)}
                            className={`px-3 py-1.5 rounded-lg text-left text-[11px] font-medium transition-colors ${targetLanguage === lang ? 'bg-primary text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="rounded-xl bg-card-dark border border-white/10 p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Show Script</span>
                  <button
                    onClick={() => setShowScript(!showScript)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${showScript ? 'bg-primary' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${showScript ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Source Language</span>
                  <div className="flex gap-1">
                    {[
                      { id: 'japan', label: 'JPN' },
                      { id: 'ch', label: 'CHI' },
                      { id: 'korean', label: 'KOR' }
                    ].map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => setOcrLanguage(lang.id)}
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${ocrLanguage === lang.id ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-slate-500 border-transparent hover:text-white'
                          }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {statusText && (
                <div className="p-3 rounded-lg bg-surface-dark border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin text-primary" />
                      {statusText}
                    </span>
                    <span className="text-primary font-bold">{ocrProgress}%</span>
                  </div>
                  <div className="h-1 w-full bg-background-dark rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            {showScript && translations.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <ScrollText size={12} /> Transcript
                  </h3>
                  <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">{translations.length} lines</span>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {translations.map((t) => (
                    <motion.div
                      key={t.id}
                      onMouseEnter={() => setHoveredMarkerId(t.id)}
                      onMouseLeave={() => setHoveredMarkerId(null)}
                      className={`p-3 rounded-xl border transition-all cursor-default relative group ${hoveredMarkerId === t.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card-dark border-white/5 hover:border-white/20'
                        }`}
                    >
                      <div className="absolute -left-1 top-3 w-4 h-4 bg-primary text-[9px] font-black text-white rounded-full flex items-center justify-center border border-white/20">
                        {t.id}
                      </div>
                      <div className="pl-3 space-y-2">
                        <div className="text-[11px] text-slate-400 italic leading-snug line-clamp-2 group-hover:line-clamp-none">
                          "{t.original}"
                        </div>
                        <div className="text-xs text-white font-medium leading-relaxed border-t border-white/5 pt-2">
                          {t.translated}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-400">Live Overlay</span>
            <button
              onClick={() => setOverlayActive(!overlayActive)}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${overlayActive ? 'bg-primary' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${overlayActive ? 'translate-x-5' : 'translate-x-1'}`}></span>
            </button>
          </div>

          <button onClick={() => setRefreshTrigger(t => t + 1)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium border border-white/5 hover:border-white/10">
            <RotateCcw size={16} />
            Regenerate Page
          </button>
        </div>
      </aside>

      {/* ============ FULLSCREEN READER OVERLAY ============ */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex"
            onTouchStart={handleFsTouchStart}
            onTouchEnd={handleFsTouchEnd}
          >
            {/* Main image area (click zones) */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden cursor-pointer select-none" onClick={handleFsClick}>
              <div className="relative inline-block max-w-full max-h-full">
                {pages.length > 0 ? (
                  <img
                    src={pages[currentPage]}
                    alt="Manga Page"
                    className="max-w-full max-h-[100vh] object-contain block"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    draggable={false}
                    onLoad={(e) => setImageScale({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  />
                ) : (
                  <div className="text-slate-500 flex flex-col items-center py-32">
                    <RefreshCw size={32} className="animate-spin mb-4 text-primary" />
                    <p>Loading...</p>
                  </div>
                )}

                {/* Script markers in fullscreen — positioned relative to image wrapper */}
                {overlayActive && pages.length > 0 && translations.map((t, idx) => {
                  const left = (t.x / imageScale.w) * 100;
                  const top = (t.y / imageScale.h) * 100;
                  return (
                    <div
                      key={idx}
                      style={{ top: `${top}%`, left: `${left}%` }}
                      className="absolute z-20 w-5 h-5 -ml-2.5 -mt-2.5 flex items-center justify-center rounded-full text-[10px] font-black text-white bg-primary/80 border-2 border-white/50 backdrop-blur-sm pointer-events-none"
                    >
                      {t.id}
                    </div>
                  );
                })}
              </div>

              {/* Click zone indicators (shown briefly) */}
              {fsControlsVisible && (
                <>
                  <div className="absolute left-0 top-0 bottom-0 w-[35%] flex items-center justify-start pl-6 pointer-events-none">
                    <div className="bg-white/5 backdrop-blur-sm rounded-full p-3">
                      <ChevronLeft size={28} className="text-white/40" />
                    </div>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-[35%] flex items-center justify-end pr-6 pointer-events-none">
                    <div className="bg-white/5 backdrop-blur-sm rounded-full p-3">
                      <ChevronRight size={28} className="text-white/40" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Fullscreen translation sidebar (toggleable) */}
            <AnimatePresence>
              {showFsTranscript && (
                <motion.aside
                  initial={{ x: 320 }}
                  animate={{ x: 0 }}
                  exit={{ x: 320 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="w-80 bg-surface-dark/95 backdrop-blur-md border-l border-white/10 flex flex-col shrink-0 overflow-hidden"
                >
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                      <Brain size={16} />
                      <span className="text-xs font-bold uppercase tracking-widest">Transcript</span>
                    </div>
                    <button onClick={() => setShowFsTranscript(false)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                      <PanelRightClose size={14} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {translations.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-8">{statusText || 'No translations yet.'}</p>
                    ) : (
                      translations.map(t => (
                        <div key={t.id} className="p-3 rounded-xl bg-card-dark border border-white/5 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 w-5 h-5 bg-primary text-[9px] font-black text-white rounded-full flex items-center justify-center">{t.id}</span>
                            <div className="text-[11px] text-slate-400 italic leading-snug">"{t.original}"</div>
                          </div>
                          <div className="text-xs text-white font-medium leading-relaxed pl-7 border-t border-white/5 pt-2">
                            {t.translated}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Top controls bar */}
            <motion.div
              initial={false}
              animate={{ opacity: fsControlsVisible ? 1 : 0, y: fsControlsVisible ? 0 : -60 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-40 pointer-events-auto"
            >
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold text-sm truncate max-w-[300px]">{manga?.title || 'Reader'}</h3>
                <span className="text-xs text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">Ch {currentChapter?.chapter || '?'} · {pages.length ? currentPage + 1 : 0}/{pages.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFsTranscript(v => !v)}
                  className={`p-2 rounded-lg transition-colors ${showFsTranscript ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title="Toggle Translation"
                >
                  {showFsTranscript ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                </button>
                <button
                  onClick={() => setOverlayActive(v => !v)}
                  className={`p-2 rounded-lg transition-colors ${overlayActive ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title="Toggle Markers"
                >
                  <Brain size={18} />
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Exit Fullscreen"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>

            {/* Bottom controls bar */}
            <motion.div
              initial={false}
              animate={{ opacity: fsControlsVisible ? 1 : 0, y: fsControlsVisible ? 0 : 60 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-t from-black/80 to-transparent z-40"
            >
              <button onClick={goPrevChapter} disabled={chapterIndex === 0} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 flex items-center gap-1 text-xs font-bold">
                <ChevronLeft size={14} /> Prev Ch
              </button>
              <button onClick={() => handlePageChange(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="p-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30">
                <ChevronLeft size={20} />
              </button>

              {/* Page progress bar */}
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                <span className="text-xs font-bold text-white whitespace-nowrap">{pages.length ? currentPage + 1 : 0} / {pages.length}</span>
                <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: pages.length ? `${((currentPage + 1) / pages.length) * 100}%` : '0%' }} />
                </div>
              </div>

              <button onClick={() => handlePageChange(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1} className="p-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30">
                <ChevronRight size={20} />
              </button>
              <button onClick={goNextChapter} disabled={chapterIndex >= chapters.length - 1} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 flex items-center gap-1 text-xs font-bold">
                Next Ch <ChevronRight size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProfilePage = ({ user, setView }: { user: User, setView: (v: View) => void }) => {
  const [username, setUsername] = useState(user.user_metadata?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const AVAILABLE_TAGS = ['Action', 'Romance', 'Comedy', 'Horror', 'Sci-Fi', 'Fantasy', 'Slice of Life', 'Mystery', 'Drama', 'Sports'];

  useEffect(() => {
    supabase.from('profiles').select('favorite_tags, bio, website, location').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.favorite_tags) setFavoriteTags(data.favorite_tags);
        if (data?.bio) setBio(data.bio);
        if (data?.website) setWebsite(data.website);
        if (data?.location) setLocation(data.location);
      });

    // Check if user has an API Key in Vault
    supabase.from('user_keys_map').select('user_id').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) setHasExistingKey(true);
      });
  }, [user.id]);

  const handleSaveKey = async () => {
    if (!apiKey.startsWith('AIza')) {
      setMessage({ text: 'Invalid Gemini API Key format.', type: 'error' });
      return;
    }
    setKeyLoading(true);
    try {
      // Test the key first
      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!testRes.ok) throw new Error('Invalid API Key');

      const { error } = await supabase.rpc('upsert_user_api_key', { api_key_text: apiKey });
      if (error) throw error;

      setHasExistingKey(true);
      setApiKey('');
      setMessage({ text: 'API Key saved securely to Vault!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Error saving API key', type: 'error' });
    }
    setKeyLoading(false);
  };

  const handleRemoveKey = async () => {
    setKeyLoading(true);
    try {
      const { error } = await supabase.rpc('remove_user_api_key');
      if (error) throw error;
      setHasExistingKey(false);
      setMessage({ text: 'API Key removed.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Error removing key.', type: 'error' });
    }
    setKeyLoading(false);
  };

  const toggleTag = (tag: string) => {
    setFavoriteTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    const { error: authError } = await supabase.auth.updateUser({
      data: { username, avatar_url: avatarUrl }
    });

    const { error: profileError } = await supabase.from('profiles').update({
      favorite_tags: favoriteTags,
      bio,
      website,
      location
    }).eq('id', user.id);

    if (authError || profileError) {
      setMessage({ text: authError?.message || profileError?.message || 'Error', type: 'error' });
    } else {
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    }
    setLoading(false);
  };

  return (
    <div className="pt-32 pb-12 px-4 flex justify-center items-center font-display">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-card-dark border border-white/10 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold overflow-hidden ring-2 ring-primary/50">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              username.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Your Profile</h2>
            <p className="text-slate-400">Manage your account settings and preferences</p>
          </div>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
            {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-background-dark border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="WeeabooMaster99"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full bg-background-dark/50 border border-white/5 rounded-xl py-3 px-4 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-background-dark border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="https://gycodes.dev"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-background-dark border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="Neo Tokyo"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all h-24 resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Avatar URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="flex-1 bg-background-dark border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="https://example.com/my-anime-pfp.jpg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Favorite Genres</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${favoriteTags.includes(tag)
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/10'
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Select your favorite genres to improve your Explore page recommendations.</p>
          </div>



          <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setView('landing')}
              className="px-6 py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const FeedbackModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: User | null }) => {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('bug');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, category })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setMessage('');
        }, 2000);
      } else {
        alert('Failed to submit feedback');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card-dark shadow-2xl border border-white/10"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            Send Feedback
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 rounded-full bg-emerald-500/20 p-3 text-emerald-400">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-white">Thank You!</h3>
              <p className="mt-2 text-sm text-slate-400">Your feedback helps us improve MangaTranslate.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-background-dark/50 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="bug">Report a Bug</option>
                  <option value="translation">Translation Issue</option>
                  <option value="suggestion">Feature Suggestion</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Message</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you think..."
                  className="w-full rounded-xl border border-white/10 bg-background-dark/50 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="w-full rounded-xl bg-primary py-3 px-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : (
                  <>
                    <Send size={18} />
                    Submit Feedback
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const AdminDashboard = ({ setView, user, addToast }: { setView: (v: View) => void, user: User | null, addToast: (msg: string, type?: Toast['type']) => void }) => {
  const [primaryColor, setPrimaryColor] = useState('#8b5cf6');
  const [backgroundDark, setBackgroundDark] = useState('#191022');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [feedbackCategory, setFeedbackCategory] = useState('all');
  const [feedbackStatus, setFeedbackStatus] = useState('all');

  const filteredFeedbacks = feedbacks.filter(f => 
    (feedbackCategory === 'all' || f.category === feedbackCategory) &&
    (feedbackStatus === 'all' || (feedbackStatus === 'unread' ? (!f.status || f.status === 'unread') : f.status === feedbackStatus))
  );

  useEffect(() => {
    fetchUsers();
    fetchFeedback();
    fetch(`${API_BASE_URL}/api/settings`).then(res => res.json()).then(data => {
      if (data) {
        setPrimaryColor(data.primary_color || '#8b5cf6');
        setBackgroundDark(data.background_dark || '#191022');
      }
    });
  }, []);

  const saveSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ primary_color: primaryColor, background_dark: backgroundDark, theme_mode: 'dark' })
      });
      if (res.ok) {
        document.documentElement.style.setProperty('--app-primary', primaryColor);
        document.documentElement.style.setProperty('--app-bg-dark', backgroundDark);
        addToast('Settings saved and applied successfully!', 'success');
      } else {
        addToast('Failed to save settings', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Network error while saving settings', 'error');
    }
  };

  const handleResetSettings = () => {
    setPrimaryColor('#8b5cf6');
    setBackgroundDark('#191022');
    document.documentElement.style.setProperty('--app-primary', '#8b5cf6');
    document.documentElement.style.setProperty('--app-bg-dark', '#191022');
    addToast('Settings reset to default. Click Save to persist.', 'info');
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, { headers });
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error(err);
    }
    setLoadingUsers(false);
  };

  const fetchFeedback = async () => {
    setLoadingFeedback(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/admin/feedback`, { headers });
      if (res.ok) setFeedbacks(await res.json());
    } catch (err) {
      console.error(err);
    }
    setLoadingFeedback(false);
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Delete this feedback?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const res = await fetch(`/api/admin/feedback/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setFeedbacks(feedbacks.filter(f => f.id !== id));
        addToast('Feedback deleted.', 'success');
      } else {
        addToast('Failed to delete feedback', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Network error deleting feedback', 'error');
    }
  };

  const handleUpdateFeedbackStatus = async (id: string, status: 'unread' | 'read' | 'completed') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/admin/feedback/${id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
      if (res.ok) {
        setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status } : f));
        addToast(`Marked as ${status}`, 'success');
      } else {
        addToast('Failed to update status', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Network error updating status', 'error');
    }
  };

  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        alert('Failed to delete user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="pt-32 pb-12 px-4 max-w-7xl mx-auto font-display">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
          <p className="text-slate-400">Manage site settings, users, and scrape tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Site Settings Panel */}
        <div className="bg-card-dark border border-white/10 rounded-2xl p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <LayoutDashboard size={18} className="text-primary" /> Theme Customizer
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Primary Accents</label>
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-none p-0" />
                <span className="text-slate-300 font-mono text-sm uppercase">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Background Customizer</label>
              <div className="flex items-center gap-3">
                <input type="color" value={backgroundDark} onChange={e => setBackgroundDark(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-none p-0" />
                <span className="text-slate-300 font-mono text-sm uppercase">{backgroundDark}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveSettings} className="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold transition-all text-sm hover:bg-primary/90 shadow-lg shadow-primary/20">
                Save Theme Settings
              </button>
              <button onClick={handleResetSettings} className="px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg font-bold transition-all text-sm" title="Revert to Default">
                Default
              </button>
            </div>
          </div>
        </div>

        {/* Users Panel */}
        <div className="bg-card-dark border border-white/10 rounded-2xl p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain size={18} className="text-emerald-400" /> User Management
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8 pr-4 py-1.5 bg-background-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary w-48"
                />
              </div>
              <button onClick={fetchUsers} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <RefreshCw size={16} className={loadingUsers ? 'animate-spin text-emerald-400' : ''} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase text-slate-400 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No users found in database.</td></tr>
                ) : users.filter(u => u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.profile?.username?.toLowerCase().includes(userSearch.toLowerCase())).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No matching search results.</td></tr>
                ) : (
                  users.filter(u => u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.profile?.username?.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{u.profile?.username || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${u.profile?.role === 'admin' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-white/10 text-slate-300 border border-white/10'}`}>
                          {u.profile?.role || 'User'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={u.profile?.role === 'admin'}
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={u.profile?.role === 'admin' ? "Cannot delete admin" : "Delete user"}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-card-dark border border-white/10 rounded-2xl p-0 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" /> User Feedback
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value)}
              className="px-3 py-1.5 bg-background-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="all">All Categories</option>
              <option value="bug">Bug</option>
              <option value="translation">Translation</option>
              <option value="suggestion">Suggestion</option>
              <option value="other">Other</option>
            </select>
            <select
              value={feedbackStatus}
              onChange={(e) => setFeedbackStatus(e.target.value)}
              className="px-3 py-1.5 bg-background-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="completed">Completed</option>
            </select>
            <button onClick={fetchFeedback} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <RefreshCw size={16} className={loadingFeedback ? "animate-spin text-primary" : ""} />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">User</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingFeedback ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading feedback...</td></tr>
              ) : feedbacks.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No feedback found.</td></tr>
              ) : filteredFeedbacks.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No feedback matches these filters.</td></tr>
              ) : (
                filteredFeedbacks.map((f) => (
                  <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-white">{f.username}</div>
                      <div className="text-xs text-slate-500">{f.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-slate-300 border border-white/10">
                        {f.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[300px]">
                      <div className="line-clamp-2 max-w-sm">{f.message}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      <div className="flex flex-col gap-1">
                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                        {f.status && (
                           <span className={`text-[10px] font-bold uppercase ${f.status === 'completed' ? 'text-emerald-400' : f.status === 'read' ? 'text-primary' : 'text-slate-500'}`}>
                              {f.status}
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedFeedback(f)}
                          className="p-1.5 rounded bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                          title="View Message"
                        >
                          <MessageSquare size={14} />
                        </button>
                        {f.status !== 'completed' && (
                          <button
                            onClick={() => handleUpdateFeedbackStatus(f.id, f.status === 'unread' ? 'read' : 'completed')}
                            className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                            title={f.status === 'unread' ? "Mark as Read" : "Mark as Completed"}
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFeedback(f.id)}
                          className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                          title="Delete feedback"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Feedback Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-card-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">Feedback Details</h2>
              <button onClick={() => setSelectedFeedback(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex gap-4 mb-4 text-sm text-slate-400">
                <div><strong>User:</strong> {selectedFeedback.username} ({selectedFeedback.email})</div>
                <div><strong>Category:</strong> <span className="uppercase">{selectedFeedback.category}</span></div>
              </div>
              <div className="bg-background-dark p-4 rounded-lg border border-white/5 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {selectedFeedback.message}
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-background-dark/50 flex justify-end gap-3">
              {selectedFeedback.status === 'unread' && (
                 <button onClick={() => { handleUpdateFeedbackStatus(selectedFeedback.id, 'read'); setSelectedFeedback(null); }} className="px-4 py-2 rounded-lg bg-primary/20 text-primary font-bold text-sm hover:bg-primary/30 transition-colors">
                   Mark as Read
                 </button>
              )}
              {selectedFeedback.status !== 'completed' && (
                 <button onClick={() => { handleUpdateFeedbackStatus(selectedFeedback.id, 'completed'); setSelectedFeedback(null); }} className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30 transition-colors flex items-center gap-2">
                   <CheckCircle size={16} /> Mark Completed
                 </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const WatchPage = ({ setView, watchQuery, setWatchQuery, addToast }: {
  setView: (v: View) => void,
  watchQuery: string,
  setWatchQuery: (q: string) => void,
  addToast: (msg: string, type?: Toast['type']) => void
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchLocal, setSearchLocal] = useState('');
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [currentEp, setCurrentEp] = useState<any>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [streamLoading, setStreamLoading] = useState(false);

  useEffect(() => {
    if (!watchQuery) {
      setLoading(false);
      return;
    }
    const fetchMetadata = async () => {
      setLoading(true);
      setError('');
      try {
        let effectiveId = watchQuery;
        // Search first if it has spaces (from general search or prior logic)
        if (effectiveId.includes(' ')) {
          const sReq = await fetch(`/api/anime/search?q=${encodeURIComponent(watchQuery)}`);
          const sRes = await sReq.json();
          if (sRes?.length > 0) effectiveId = sRes[0].animeId;
          else throw new Error("No anime found for this title.");
        }

        const res = await fetch(`/api/anime/details/${encodeURIComponent(effectiveId)}`);
        const json = await res.json();

        if (json && !json.error) {
          setData(json);
          const eplist = json.episodeList || json.info?.episodeList || [];
          setEpisodes([...eplist].reverse()); // Sanka serves newest first, flip it for logical timeline
          if (eplist.length > 0) setCurrentEp(eplist[eplist.length - 1]);
        } else {
          setData(null);
          setError(json?.error?.toString() || 'We could not load adaptation details.');
        }
      } catch (err: any) {
        setData(null);
        setError(err?.message?.toString() || 'Network error resolving Anime database.');
      }
      setLoading(false);
    };
    fetchMetadata();
  }, [watchQuery]);

  useEffect(() => {
    if (!currentEp) return;
    const fetchStream = async () => {
      setStreamLoading(true);
      setStreamUrl('');
      try {
        const res = await fetch(`/api/anime/stream/${encodeURIComponent(currentEp.episodeId)}`);
        const sjson = await res.json();
        if (sjson?.streamUrl) {
          setStreamUrl(sjson.streamUrl);
        } else if (sjson?.error) {
          addToast(sjson.error, 'error');
        } else {
          addToast("Streaming link unavailable for this episode.", 'error');
        }
      } catch (err) {
        addToast("Network error fetching stream.", 'error');
      }
      setStreamLoading(false);
    };
    fetchStream();
  }, [currentEp]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchLocal.trim()) setWatchQuery(searchLocal.trim());
  };

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl font-display">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setView('anime')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} /> Back to Anime Home
        </button>
        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
          <input
            type="text"
            value={searchLocal}
            onChange={(e) => setSearchLocal(e.target.value)}
            placeholder="Search anime..."
            className="w-full bg-black/40 border border-white/10 rounded-full py-2 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-[#FF6B6B]/50 transition-colors"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF6B6B]">
            <Search size={16} />
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40">
          <Zap size={40} className="text-[#FF6B6B] animate-pulse mb-4" />
          <h2 className="text-xl font-bold text-white">Synthesizing Anime Data...</h2>
        </div>
      ) : error ? (
        <div className="text-center py-40 bg-card-dark rounded-3xl border border-white/5 border-dashed">
          <AlertCircle size={40} className="mx-auto text-slate-500 mb-4" />
          <p className="text-xl font-bold text-white mb-2">{error}</p>
          <button onClick={() => setView('anime')} className="text-[#FF6B6B] hover:underline mt-4">Browse Trending</button>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Main Player Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 shadow-2xl">
              <div className="aspect-video bg-black rounded-t-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative group">
                {streamUrl ? (
                  <iframe
                    src={streamUrl}
                    className="w-full h-full border-0 absolute top-0 left-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-card-dark border-b border-white/10">
                    <Zap size={40} className={`text-slate-600 mb-4 ${streamLoading ? 'animate-pulse text-[#FF6B6B]' : ''}`} />
                    <p className="text-slate-400 font-bold">{streamLoading ? "Loading Stream Proxy..." : "Select an episode below"}</p>
                  </div>
                )}
              </div>

              {/* Episodes Grid below player */}
              <div className="bg-white/[0.02] border border-white/5 rounded-b-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2"><BookOpen size={18} className="text-[#FF6B6B]" /> Episodes</h3>
                  <span className="text-xs font-bold text-slate-500 bg-black/40 px-3 py-1 rounded-full">{episodes.length} Available</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {episodes.map((ep: any) => (
                    <button
                      key={ep.episodeId}
                      onClick={() => setCurrentEp(ep)}
                      className={`p-2 rounded text-xs font-bold text-center border transition-all ${currentEp?.episodeId === ep.episodeId ? 'bg-[#FF6B6B]/20 text-[#FF6B6B] border-[#FF6B6B]/40 shadow-inner' : 'bg-black/40 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'}`}
                    >
                      EP {ep.eps || ep.title?.replace('Episode ', '') || '?'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 pl-2">
                <h1 className="text-3xl font-black text-white leading-tight">{data.title}</h1>
                <p className="text-[#FF6B6B] font-bold mt-2 text-sm uppercase tracking-widest">{currentEp?.title || "No Episode Selected"}</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <span className="px-3 py-1 rounded-full bg-white/5 text-slate-300 text-xs font-bold border border-white/10">{data.status}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-slate-300 text-xs font-bold border border-white/10">{data.info?.type || data.type || 'TV'}</span>
                </div>
              </div>
            </div>

            {/* Side Panel: Details */}
            <div className="lg:col-span-1 border border-white/5 bg-white/[0.02] rounded-2xl p-6 h-fit">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Library size={18} className="text-[#FF6B6B]" /> Media Metadata</h3>
              <div className="flex items-center justify-center mb-6">
                {data.poster && <img src={data.poster} alt={data.title} className="w-1/2 rounded-lg shadow-lg" />}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">Duration</span>
                  <span className="text-slate-300 font-medium text-right">{data.info?.duration || data.duration || '?'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">Encoder / Studio</span>
                  <span className="text-slate-300 font-medium">{data.info?.encoder || data.info?.credit || data.producers || data.studios || 'Unknown'}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
                  {(data.info?.genreList || data.genreList || []).map((g: any) => (
                    <span key={g.title} className="px-2 py-1 text-[10px] rounded bg-white/5 text-slate-400 capitalize">{g.title}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40">
          <BookCopy size={60} className="text-slate-600 mb-6" />
          <h2 className="text-2xl font-bold text-white text-center">Ready to Sync</h2>
          <p className="text-slate-400 text-center max-w-md mt-2">Enter an anime title in the search bar above to begin streaming episodes directly.</p>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [isAnimeMode, setIsAnimeMode] = useState(false);
  const [watchQuery, setWatchQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trendingManga, setTrendingManga] = useState<Manga[]>([]);
  const [trendingAnime, setTrendingAnime] = useState<Manga[]>([]);
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [selectedSource, setSelectedSource] = useState<'mangadex' | 'mangabuddy'>('mangadex');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);

  useEffect(() => {
    // Fetch Global Site Settings
    fetch(`${API_BASE_URL}/api/settings`).then(res => res.json()).then(data => {
      if (data && data.primary_color) {
        document.documentElement.style.setProperty('--app-primary', data.primary_color);
      }
      if (data && data.background_dark) {
        document.documentElement.style.setProperty('--app-bg-dark', data.background_dark);
      }
    }).catch(console.error);

    const fetchRole = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (data) setRole(data.role as 'user' | 'admin');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else setRole('user');
    });

    return () => subscription.unsubscribe();
  }, []);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    if (isAnimeMode && trendingAnime.length === 0) {
      fetch(`${API_BASE_URL}/api/anime/trending`)
        .then(r => r.json())
        .then(data => {
          const items = data?.items || (Array.isArray(data) ? data : []);
          if (items.length > 0) setTrendingAnime(items);
        })
        .catch(console.error);
    }
  }, [isAnimeMode]);

  useEffect(() => {
    // Stale-while-revalidate: serve cached trending instantly, then refresh
    const cached = localStorage.getItem('manga_trending_cache');
    if (cached) {
      try { setTrendingManga(JSON.parse(cached)); } catch (_) { }
    }

    // Fetch favorite genres from profile to personalize Explore page
    const loadData = async () => {
      let genreParams = '';
      if (session?.access_token && session.user) {
        try {
          const { data: profile } = await supabase.from('profiles').select('favorite_tags').eq('id', session.user.id).single();
          if (profile?.favorite_tags?.length) {
            setFavoriteGenres(profile.favorite_tags);
            genreParams = `?genres=${encodeURIComponent(profile.favorite_tags.join(','))}`;
          }
        } catch (_) { }
      }

      // Parallel fetch all startup data
      const headers: Record<string, string> = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const [trendingRes, tasksRes, historyRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/manga/trending${genreParams}`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/tasks/active`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/history`, { headers }).then(r => r.json()),
      ]);

      if (trendingRes.status === 'fulfilled') {
        const val = trendingRes.value;
        const items = val?.items || (Array.isArray(val) ? val : []);
        if (items.length > 0) {
          setTrendingManga(items);
          localStorage.setItem('manga_trending_cache', JSON.stringify(items));
        }
      }
      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) setTasks(tasksRes.value);
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) setHistoryList(historyRes.value);
    };

    loadData().catch(console.error);
  }, [session]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      const endpoint = isAnimeMode
        ? `/api/anime/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/manga/search?q=${encodeURIComponent(searchQuery)}`;
      fetch(`${API_BASE_URL}${endpoint}`)
        .then(res => res.json())
        .then(data => {
          if (isAnimeMode && Array.isArray(data)) {
            // Map Sanka anime results to Manga card shape
            setSearchResults(data.map((a: any) => ({
              id: a.animeId || a.id,
              title: a.title,
              cover: a.poster || a.cover,
              genre: a.genreList?.map((g: any) => g.title) || [],
              rating: a.score || null,
              status: a.status || 'Unknown'
            })));
          } else if (data?.items) {
            // Paginated response
            setSearchResults(data.items);
          } else {
            setSearchResults(Array.isArray(data) ? data : []);
          }
        })
        .catch(console.error);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, isAnimeMode]);

  const handleSelectManga = async (manga: Manga) => {
    setSelectedManga(manga);
    if (isAnimeMode && manga?.title) {
      addToast('Verifying Anime Engine Data...', 'info');
      try {
        const sanitizedTitle = manga.title.replace(/[^a-zA-Z0-9\s\-:]/g, ' ').replace(/\s+/g, ' ').trim();
        const res = await fetch(`/api/anime/search?q=${encodeURIComponent(sanitizedTitle)}`);
        const payload = await res.json();

        if (payload && payload.length > 0) {
          const topResult = payload[0];
          setWatchQuery(topResult.animeId);
          setView('watch');
        } else {
          addToast("No Anime adaptation found for this title.", "error");
          setView('detail');
        }
      } catch (e) {
        addToast("Network Error checking Anime DB.", "error");
        setView('detail');
      }
    } else {
      setView('detail');
    }
  };

  const handleImportUrl = async (url: string) => {
    try {
      addToast('Starting import...', 'info');
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`${API_BASE_URL}/api/library/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasks(prev => [data.task, ...prev]);
      addToast(`Import started: ${data.task.title}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to start import', 'error');
    }
  };

  const handleAddToLibrary = async (manga: Manga) => {
    if (!user) {
      setView('login');
      return;
    }
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`${API_BASE_URL}/api/library`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mangaId: manga.id,
          title: manga.title,
          cover: manga.cover,
          genre: manga.genre,
          rating: manga.rating,
          status: manga.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add to library');
      addToast('Added to library!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleFileUpload = (files: FileList) => {
    const newTasks: Task[] = Array.from(files).map((file, index) => ({
      id: `u-${Date.now()}-${index}`,
      title: file.name,
      chapter: 'Local Upload',
      status: 'Scraping',
      progress: 0,
      cover: 'https://picsum.photos/seed/upload/100/150',
      timeRemaining: 'Calculating...'
    }));

    setTasks(prev => [...newTasks, ...prev]);

    // Simulate progress
    newTasks.forEach(task => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 10) + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'Ready', progress: 100, timeRemaining: 'Done' } : t));
        } else {
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress } : t));
        }
      }, 1000);
    });
  };

  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-display selection:bg-primary selection:text-white">
      <Navbar currentView={view} setView={setView} onUpload={handleFileUpload} searchQuery={searchQuery} setSearchQuery={setSearchQuery} user={user} role={role} isAnimeMode={isAnimeMode} setIsAnimeMode={setIsAnimeMode} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <main className="min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'landing' && <LandingPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} trendingManga={isAnimeMode ? trendingAnime : trendingManga} searchResults={searchResults} onImportUrl={handleImportUrl} favoriteGenres={favoriteGenres} isAnimeMode={isAnimeMode} setIsAnimeMode={setIsAnimeMode} />}
            {view === 'dashboard' && (user ? <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} historyList={historyList} /> : <LoginPage setView={setView} />)}
            {view === 'reader' && <Reader setView={setView} manga={selectedManga} session={session} source={selectedSource} />}
            {view === 'library' && (user ? <LibraryPage setView={setView} onSelectManga={handleSelectManga} user={user} session={session} /> : <LoginPage setView={setView} />)}
            {view === 'login' && (!user ? <LoginPage setView={setView} /> : <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} historyList={historyList} />)}
            {view === 'signup' && (!user ? <SignupPage setView={setView} /> : <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} historyList={historyList} />)}
            {view === 'profile' && (user ? <ProfilePage user={user} setView={setView} /> : <LoginPage setView={setView} />)}
            {view === 'admin' && (role === 'admin' ? <AdminDashboard setView={setView} user={user} addToast={addToast} /> : <LandingPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} trendingManga={trendingManga} searchResults={searchResults} onImportUrl={handleImportUrl} favoriteGenres={favoriteGenres} />)}
            {view === 'detail' && selectedManga && <MangaDetailPage manga={selectedManga} setView={setView} onAddToLibrary={handleAddToLibrary} source={selectedSource} setSource={setSelectedSource} setWatchQuery={setWatchQuery} />}
            {view === 'watch' && <WatchPage setView={setView} watchQuery={watchQuery} setWatchQuery={setWatchQuery} addToast={addToast} />}
            {view === 'anime' && <LandingPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} trendingManga={trendingAnime} searchResults={searchResults} onImportUrl={handleImportUrl} favoriteGenres={favoriteGenres} isAnimeMode={true} setIsAnimeMode={setIsAnimeMode} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {view !== 'reader' && view !== 'login' && view !== 'signup' && view !== 'profile' && view !== 'admin' && (
        <footer className="border-t border-white/10 bg-background-dark py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/20 text-primary">
                <Languages size={14} />
              </div>
              <span className="text-lg font-bold">MangaTranslate</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-400">
              <a className="hover:text-white transition-colors" href="https://discord.gg/RQMYVMGCCR" target="_blank" rel="noopener noreferrer">Discord</a>
            </div>
            <div className="text-sm text-slate-500">
              © 2026 MangaTranslate. Built by <a href="https://github.com/GYCODES" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-white transition-colors">GYCODES</a>.
            </div>
          </div>
        </footer>
      )}

      {/* Floating Feedback Button */}
      {view !== 'reader' && (
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110 focus:outline-none"
          title="Send Feedback"
        >
          <MessageSquare size={24} />
        </button>
      )}

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} user={user} />
    </div>
  );
}
