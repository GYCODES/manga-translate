/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { Session, User } from '@supabase/supabase-js';

// --- State Interfaces ---
type View = 'landing' | 'dashboard' | 'reader' | 'library' | 'login' | 'signup' | 'detail' | 'profile' | 'admin';

interface Manga {
  id: string;
  title: string;
  cover: string;
  genre: string[];
  rating: number;
  status: string;
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

const Navbar = ({ currentView, setView, onUpload, searchQuery, setSearchQuery, user, role }: {
  currentView: View,
  setView: (v: View) => void,
  onUpload: (files: FileList) => void,
  searchQuery: string,
  setSearchQuery: (q: string) => void,
  user: User | null,
  role: 'user' | 'admin'
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#191022]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setView('landing')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Languages size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white hidden sm:block">MangaTranslate</span>
        </div>

        <div className="flex items-center gap-4 flex-1 justify-end md:justify-center px-4">
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
                    placeholder="Search manga titles..."
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

          <nav className={`flex items-center gap-4 md:gap-6 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
            <button onClick={() => setView('landing')} className={`text-sm font-medium transition-colors ${currentView === 'landing' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Explore</button>
            {user && (
              <>
                <button onClick={() => setView('library')} className={`text-sm font-medium transition-colors ${currentView === 'library' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Library</button>
                <button onClick={() => setView('dashboard')} className={`text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Dashboard</button>
                {role === 'admin' && (
                  <button onClick={() => setView('admin')} className={`text-sm font-medium transition-colors ${currentView === 'admin' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-emerald-400 hover:text-emerald-300 flex items-center gap-1'}`}><Settings size={14} /> Admin</button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-bold"
                >
                  <CloudUpload size={16} />
                  Import
                </button>
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

const LandingPage = ({ setView, searchQuery, onSelectManga, trendingManga, searchResults, onImportUrl }: { setView: (v: View) => void, searchQuery: string, onSelectManga: (m: Manga) => void, trendingManga: Manga[], searchResults: Manga[], onImportUrl: (url: string) => void }) => {
  const displayManga = searchQuery.trim() ? searchResults : trendingManga;
  const [heroUrl, setHeroUrl] = useState('');
  const [importing, setImporting] = useState(false);

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
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">v2.0 Now Live: Better OCR</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Read Any Manga <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">In Your Language.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-300"
            >
              Paste a URL and our advanced AI will clean, translate, and typeset the manga in seconds, preserving the original art style.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-10 w-full max-w-xl"
            >
              <div className="group relative flex items-center rounded-xl bg-background-dark/50 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur-md focus-within:ring-primary focus-within:ring-2 transition-all">
                <div className="flex h-10 w-12 items-center justify-center text-slate-400">
                  <LinkIcon size={20} />
                </div>
                <input
                  className="h-12 w-full bg-transparent text-white placeholder-slate-500 focus:outline-none border-none text-base"
                  placeholder="Paste manga URL (Mangadex, Rawkuma, etc.)"
                  type="text"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                />
                <button
                  onClick={handleImport}
                  disabled={importing || !heroUrl.trim()}
                  className="absolute right-2 top-2 bottom-2 rounded-lg bg-primary px-6 text-sm font-bold text-white shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Translate</span>
                  <Zap size={16} />
                </button>
              </div>
              <div className="mt-3 flex justify-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Auto-Cleaning</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Smart In-painting</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={14} /> 50+ Languages</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-primary" />
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Trending Now'}
          </h2>
          <div className="flex gap-2">
            <button className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"><ChevronLeft /></button>
            <button className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"><ChevronRight /></button>
          </div>
        </div>

        {displayManga.length > 0 ? (
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
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <button className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-white shadow-lg">View Details</button>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-xs text-white font-bold flex items-center gap-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" /> {manga.rating}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-white leading-tight group-hover:text-primary transition-colors">{manga.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    {manga.genre.map(g => <span key={g}>{g}</span>)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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

const LibraryPage = ({ setView, searchQuery, onSelectManga, trendingManga, searchResults }: { setView: (v: View) => void, searchQuery: string, onSelectManga: (m: Manga) => void, trendingManga: Manga[], searchResults: Manga[] }) => {
  const [activeTab, setActiveTab] = useState<'reading' | 'completed' | 'plan_to_read'>('reading');

  const displayManga = searchQuery.trim() ? searchResults : trendingManga;

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Library</h1>
          <p className="text-slate-400 mt-1">Your collection of translated manga and saved titles.</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors">
            <LayoutDashboard size={18} />
          </button>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {displayManga.length > 0 ? (
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
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <button className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-white shadow-lg">View Details</button>
                </div>
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-xs text-white font-bold flex items-center gap-1">
                  <Star size={12} className="text-yellow-400 fill-yellow-400" /> {manga.rating}
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white leading-tight group-hover:text-primary transition-colors">{manga.title}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Ch. 102 Read</span>
                  <span className="text-[10px] text-primary font-bold">85% Complete</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg">No manga found in your library matching "{searchQuery}".</p>
        </div>
      )}
    </div>
  );
};

const MangaDetailPage = ({ manga, setView }: { manga: Manga, setView: (v: View) => void }) => {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: manga.title })
        });
        const data = await response.json();
        if (!response.ok) {
          setSummary(data.error || 'Failed to load AI summary.');
        } else {
          setSummary(data.summary || 'No summary available.');
        }
      } catch (error) {
        console.error('Error fetching summary:', error);
        setSummary('Failed to load AI summary.');
      } finally {
        setLoading(false);
      }
    };
    if (manga?.title) {
      fetchSummary();
    }
  }, [manga]);

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
            <img src={manga.cover} alt={manga.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
              <Brain size={20} className={loading ? 'animate-pulse' : ''} />
              <h3 className="font-bold uppercase tracking-wider text-sm">AI Summary</h3>
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
                {summary}
              </motion.p>
            )}

            <div className="absolute -right-4 -bottom-4 text-primary/5 rotate-12">
              <Zap size={120} />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setView('reader')}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen size={20} />
              Start Reading
            </button>
            <button className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
              <History size={20} />
            </button>
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
      setView('dashboard');
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
      setView('dashboard');
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
          <button disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:bg-primary/90 transition-all mt-6 disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Create Account'}
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

const Reader = ({ setView, manga }: { setView: (v: View) => void, manga: Manga | null }) => {
  const [chapters, setChapters] = useState<any[]>([]);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [translations, setTranslations] = useState<any[]>([]);
  const [overlayActive, setOverlayActive] = useState(true);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (manga) {
      setStatusText('Fetching chapters...');
      fetch(`/api/manga/${manga.id}/chapters`).then(res => res.json()).then(data => {
        if (data && data.length > 0) {
          setChapters(data);
          setCurrentChapter(data[0]);
        }
      });
    }
  }, [manga]);

  useEffect(() => {
    if (currentChapter) {
      setStatusText('Fetching pages...');
      setPages([]);
      fetch(`/api/manga/chapter/${currentChapter.id}/pages`).then(res => res.json()).then(data => {
        if (data && data.length > 0) {
          setPages(data);
          setCurrentPage(0);
        } else {
          setStatusText('No pages found for this chapter.');
        }
      });
    }
  }, [currentChapter]);

  useEffect(() => {
    if (pages.length > 0 && pages[currentPage] && overlayActive) {
      setStatusText('Translating page with Gemini Vision...');
      setTranslations([]);
      fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: pages[currentPage] })
      }).then(res => res.json()).then(data => {
        if (data.translations) setTranslations(data.translations);
        setStatusText('');
      }).catch(err => {
        setStatusText('Translation failed.');
      });
    } else {
      setStatusText('');
    }
  }, [pages, currentPage, overlayActive]);

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
              onClick={() => setCurrentChapter(ch)}
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
          <div className="relative w-full aspect-[2/3] max-w-[800px] shadow-2xl rounded-sm overflow-hidden bg-surface-dark flex items-center justify-center">
            {pages.length > 0 ? (
              <img
                src={pages[currentPage]}
                alt="Manga Page"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                loading="eager"
              />
            ) : (
              <div className="text-slate-500 flex flex-col items-center">
                <RefreshCw size={32} className="animate-spin mb-4 text-primary" />
                <p>{statusText || 'Loading...'}</p>
              </div>
            )}

            {/* Overlays */}
            {overlayActive && pages.length > 0 && translations.map((t, idx) => {
              // Create randomized positions for the dummy bubbles just to show them, since Gemini Vision doesn't cleanly return bounding boxes yet without heavy prompting.
              const top = 15 + (idx * 25) % 60;
              const left = 10 + (idx * 30) % 70;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ top: `${top}%`, left: `${left}%` }}
                  className="absolute w-[25%] h-auto min-h-[10%] group cursor-help z-20"
                >
                  <div className="text-center font-bold text-black bg-white p-2 rounded-2xl shadow-lg shadow-black/50 text-[11px] leading-tight w-full h-full flex items-center justify-center border-2 border-black">
                    {t.translated}
                  </div>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-900 text-white text-[10px] p-3 rounded-lg shadow-xl border border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="font-bold text-sm mb-1">{t.original}</div>
                    <div className="text-primary flex items-center gap-1 mt-2">
                      <Zap size={10} /> Neural Translated
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="sticky bottom-6 flex items-center gap-4 bg-surface-dark/90 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 shadow-2xl z-30">
            <button onClick={() => setCurrentPage(0)} disabled={currentPage === 0} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors disabled:opacity-30"><ChevronsLeft size={20} /></button>
            <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors disabled:opacity-30"><ChevronLeft size={20} /></button>
            <span className="text-sm font-bold text-white px-2">Page {pages.length ? currentPage + 1 : 0}</span>
            <button onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors disabled:opacity-30"><ChevronRight size={20} /></button>
            <div className="h-6 w-px bg-white/10 mx-1"></div>
            <button className="p-2 hover:bg-white/5 rounded-full text-white transition-colors"><ZoomIn size={20} /></button>
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

        <div className="p-5 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Translation Engine</label>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex flex-col items-center justify-center p-3 rounded-lg bg-primary border border-primary text-white shadow-lg shadow-primary/20">
                <Brain size={20} className="mb-1" />
                <span className="text-[10px] font-bold">GPT-4 Turbo</span>
              </button>
              <button className="flex flex-col items-center justify-center p-3 rounded-lg bg-card-dark border border-transparent text-gray-400 hover:border-gray-600 hover:text-white transition-all">
                <Languages size={20} className="mb-1" />
                <span className="text-[10px] font-bold">DeepL Pro</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Source Language</label>
              <div className="flex items-center justify-between w-full bg-background-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Auto-Detect (JP)</span>
                </div>
                <ChevronRight size={14} className="rotate-90 text-gray-500" />
              </div>
            </div>
            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-surface-dark p-1 rounded-full border border-white/10">
                <ArrowDown size={14} className="text-gray-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Target Language</label>
              <div className="flex items-center justify-between w-full bg-background-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white">
                <div className="flex items-center gap-2">
                  <Flag size={14} />
                  <span>English (US)</span>
                </div>
                <ChevronRight size={14} className="rotate-90 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="bg-card-dark rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Live Overlay</span>
              <button
                onClick={() => setOverlayActive(!overlayActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${overlayActive ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${overlayActive ? 'translate-x-6' : 'translate-x-1'}`}></span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Instantly replaces text bubbles. Toggle off to see original raw scans.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Translation Confidence</span>
              <span className="text-primary font-bold">94%</span>
            </div>
            <div className="h-1.5 w-full bg-background-dark rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-purple-400 w-[94%] rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/10">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-white/10 hover:border-primary/50 hover:bg-card-dark text-white transition-all text-sm font-medium group">
            <RotateCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            Regenerate Page
          </button>
        </div>
      </aside>
    </div>
  );
};

const ProfilePage = ({ user, setView }: { user: User, setView: (v: View) => void }) => {
  const [username, setUsername] = useState(user.user_metadata?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const AVAILABLE_TAGS = ['Action', 'Romance', 'Comedy', 'Horror', 'Sci-Fi', 'Fantasy', 'Slice of Life', 'Mystery', 'Drama', 'Sports'];

  useEffect(() => {
    supabase.from('profiles').select('favorite_tags').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.favorite_tags) setFavoriteTags(data.favorite_tags);
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
      const { error: deleteMapError } = await supabase.from('user_keys_map').delete().eq('user_id', user.id);
      if (deleteMapError) throw deleteMapError;

      setHasExistingKey(false);
      setMessage({ text: 'API Key removed.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: 'Error removing key.', type: 'error' });
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
      favorite_tags: favoriteTags
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

          <div className="pt-8 mt-8 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={20} className="text-primary" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Manage API Key (BYOK)</h3>
            </div>

            <div className="bg-background-dark/50 rounded-2xl p-6 border border-white/5 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Gemini API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={hasExistingKey ? "AIza••••••••••••••••••••xR4" : "Paste your Gemini API Key here"}
                      className="w-full bg-background-dark border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all pr-12"
                    />
                    <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={keyLoading || !apiKey}
                    className="bg-primary text-white px-6 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {keyLoading ? '...' : 'Save Key'}
                  </button>
                </div>
              </div>

              {hasExistingKey && (
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>Vault Encryption Active: Gemini API Key is stored periodically.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
                  >
                    Remove Key
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-500">
                Your API key is encrypted at rest using Supabase Vault and is never exposed to the frontend after saving.
                It is used exclusively by the backend to perform translations.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setView('dashboard')}
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

const AdminDashboard = ({ setView }: { setView: (v: View) => void }) => {
  const [primaryColor, setPrimaryColor] = useState('#8b5cf6');
  const [backgroundDark, setBackgroundDark] = useState('#191022');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetch('/api/settings').then(res => res.json()).then(data => {
      if (data) {
        setPrimaryColor(data.primary_color || '#8b5cf6');
        setBackgroundDark(data.background_dark || '#191022');
      }
    });
  }, []);

  const saveSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_color: primaryColor, background_dark: backgroundDark, theme_mode: 'dark' })
      });
      if (res.ok) {
        document.documentElement.style.setProperty('--app-primary', primaryColor);
        document.documentElement.style.setProperty('--app-bg-dark', backgroundDark);
        alert('Settings saved and applied!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error(err);
    }
    setLoadingUsers(false);
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
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
            <button onClick={saveSettings} className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-2 rounded-lg font-bold transition-all mt-4 text-sm">
              Save Theme Settings
            </button>
          </div>
        </div>

        {/* Users Panel */}
        <div className="bg-card-dark border border-white/10 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain size={18} className="text-emerald-400" /> User Management
            </h2>
            <button onClick={fetchUsers} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={16} className={loadingUsers ? 'animate-spin text-emerald-400' : ''} />
            </button>
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
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No users found.</td></tr>
                ) : (
                  users.map((u) => (
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
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trendingManga, setTrendingManga] = useState<Manga[]>([]);
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    // Fetch Global Site Settings
    fetch('/api/settings').then(res => res.json()).then(data => {
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
    fetch('/api/manga/trending')
      .then(res => res.json())
      .then(data => setTrendingManga(data))
      .catch(console.error);

    fetch('/api/tasks/active')
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(console.error);

    fetch('/api/history')
      .then(res => res.json())
      .then(data => setHistoryList(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/manga/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => setSearchResults(data))
        .catch(console.error);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelectManga = (manga: Manga) => {
    setSelectedManga(manga);
    setView('detail');
  };

  const handleImportUrl = async (url: string) => {
    try {
      addToast('Starting import...', 'info');
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <Navbar currentView={view} setView={setView} onUpload={handleFileUpload} searchQuery={searchQuery} setSearchQuery={setSearchQuery} user={user} role={role} />
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
            {view === 'landing' && <LandingPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} trendingManga={trendingManga} searchResults={searchResults} onImportUrl={handleImportUrl} />}
            {view === 'dashboard' && (user ? <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} historyList={historyList} /> : <LoginPage setView={setView} />)}
            {view === 'reader' && <Reader setView={setView} manga={selectedManga} />}
            {view === 'library' && (user ? <LibraryPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} trendingManga={trendingManga} searchResults={searchResults} /> : <LoginPage setView={setView} />)}
            {view === 'login' && (!user ? <LoginPage setView={setView} /> : <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} historyList={historyList} />)}
            {view === 'signup' && (!user ? <SignupPage setView={setView} /> : <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} historyList={historyList} />)}
            {view === 'profile' && (user ? <ProfilePage user={user} setView={setView} /> : <LoginPage setView={setView} />)}
            {view === 'admin' && (role === 'admin' ? <AdminDashboard setView={setView} /> : <LandingPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} trendingManga={trendingManga} searchResults={searchResults} onImportUrl={handleImportUrl} />)}
            {view === 'detail' && selectedManga && <MangaDetailPage manga={selectedManga} setView={setView} />}
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
              <a className="hover:text-white transition-colors" href="#">Terms</a>
              <a className="hover:text-white transition-colors" href="#">Privacy</a>
              <a className="hover:text-white transition-colors" href="#">DMCA</a>
              <a className="hover:text-white transition-colors" href="#">Discord</a>
            </div>
            <div className="text-sm text-slate-500">
              © 2026 MangaTranslate. Built by <a href="https://github.com/GYCODES" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-white transition-colors">GYCODES</a>.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
