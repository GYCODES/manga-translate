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
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---
type View = 'landing' | 'dashboard' | 'reader' | 'library' | 'login' | 'signup' | 'detail';

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

// --- Mock Data ---
const TRENDING_MANGA: Manga[] = [
  { id: '1', title: 'Berserk', cover: 'https://picsum.photos/seed/berserk/400/600', genre: ['Dark Fantasy', 'Action'], rating: 4.9, status: 'Ongoing' },
  { id: '2', title: 'Attack on Titan', cover: 'https://picsum.photos/seed/aot/400/600', genre: ['Post-Apocalyptic'], rating: 4.8, status: 'Completed' },
  { id: '3', title: 'Demon Slayer', cover: 'https://picsum.photos/seed/ds/400/600', genre: ['Adventure', 'Supernatural'], rating: 4.7, status: 'Ongoing' },
  { id: '4', title: 'Tokyo Ghoul', cover: 'https://picsum.photos/seed/tg/400/600', genre: ['Horror', 'Psychological'], rating: 4.6, status: 'Completed' },
  { id: '5', title: 'My Hero Academia', cover: 'https://picsum.photos/seed/mha/400/600', genre: ['Superhero', 'School'], rating: 4.5, status: 'Ongoing' },
];

const ACTIVE_TASKS: Task[] = [
  { id: 't1', title: 'One Piece', chapter: 'Chapters 1092-1095', status: 'Scraping', progress: 45, cover: 'https://picsum.photos/seed/op/100/150', timeRemaining: '2m' },
  { id: 't2', title: 'Jujutsu Kaisen', chapter: 'Chapter 236', status: 'Cleaning', progress: 78, cover: 'https://picsum.photos/seed/jjk/100/150', timeRemaining: '45s' },
  { id: 't3', title: 'Tokyo Ghoul', chapter: 'Volume 1 Full', status: 'Translating', progress: 12, cover: 'https://picsum.photos/seed/tg2/100/150', timeRemaining: '15m' },
];

const HISTORY = [
  { id: 'h1', title: 'Chainsaw Man', chapter: 'Ch. 142', source: 'Mangadex', date: 'Oct 24, 2023', status: 'Completed', cover: 'https://picsum.photos/seed/csm/80/100' },
  { id: 'h2', title: 'Berserk', chapter: 'Vol. 41', source: 'Local Upload', date: 'Oct 23, 2023', status: 'Completed', cover: 'https://picsum.photos/seed/berserk2/80/100' },
  { id: 'h3', title: 'Attack on Titan', chapter: 'Ch. 139', source: 'Rawkuma', date: 'Oct 22, 2023', status: 'Failed', cover: 'https://picsum.photos/seed/aot2/80/100' },
];

// --- Components ---

const Navbar = ({ currentView, setView, onUpload, searchQuery, setSearchQuery }: { 
  currentView: View, 
  setView: (v: View) => void, 
  onUpload: (files: FileList) => void,
  searchQuery: string,
  setSearchQuery: (q: string) => void
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
                  className="w-full bg-background-dark/50 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              )}
            </AnimatePresence>
          </motion.div>
          
          <nav className={`flex items-center gap-4 md:gap-6 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
            <button onClick={() => setView('landing')} className={`text-sm font-medium transition-colors ${currentView === 'landing' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Explore</button>
            <button onClick={() => setView('library')} className={`text-sm font-medium transition-colors ${currentView === 'library' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Library</button>
            <button onClick={() => setView('dashboard')} className={`text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'text-white border-b-2 border-primary pb-0.5' : 'text-slate-300 hover:text-white'}`}>Dashboard</button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-bold"
            >
              <CloudUpload size={16} />
              Import
            </button>
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
          <button onClick={() => setView('login')} className="hidden sm:flex h-9 items-center justify-center rounded-lg px-4 text-sm font-bold text-slate-200 hover:bg-white/5 transition-colors">Log In</button>
          <button onClick={() => setView('signup')} className="flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-[0_0_15px_rgba(127,19,236,0.5)] hover:bg-primary/90 transition-all">Sign Up</button>
        </div>
      </div>
    </header>
  );
};

const LandingPage = ({ setView, searchQuery, onSelectManga }: { setView: (v: View) => void, searchQuery: string, onSelectManga: (m: Manga) => void }) => {
  const filteredManga = TRENDING_MANGA.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Read Any Manga <br className="hidden sm:block"/>
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
                />
                <button 
                  onClick={() => setView('reader')}
                  className="absolute right-2 top-2 bottom-2 rounded-lg bg-primary px-6 text-sm font-bold text-white shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
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
        
        {filteredManga.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredManga.map((manga) => (
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

const Dashboard = ({ setView, onUpload, tasks }: { setView: (v: View) => void, onUpload: (files: FileList) => void, tasks: Task[] }) => (
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        task.status === 'Scraping' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
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
            {HISTORY.map(item => (
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
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                    item.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
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

const LibraryPage = ({ setView, searchQuery, onSelectManga }: { setView: (v: View) => void, searchQuery: string, onSelectManga: (m: Manga) => void }) => {
  const filteredManga = TRENDING_MANGA.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {filteredManga.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredManga.map((manga) => (
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
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide a brief, engaging summary of the manga titled "${manga.title}". Focus on the premise and why it's popular. Keep it under 100 words.`,
        });
        setSummary(response.text || 'No summary available.');
      } catch (error) {
        console.error('Error fetching summary:', error);
        setSummary('Failed to load AI summary.');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
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

const LoginPage = ({ setView }: { setView: (v: View) => void }) => (
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

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setView('dashboard'); }}>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Email Address</label>
          <input 
            type="email" 
            className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none" 
            placeholder="name@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
          <input 
            type="password" 
            className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none" 
            placeholder="••••••••"
            required
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
            <input type="checkbox" className="rounded border-white/10 bg-background-dark text-primary focus:ring-primary" />
            Remember me
          </label>
          <a href="#" className="text-primary hover:text-white transition-colors">Forgot password?</a>
        </div>
        <button className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:bg-primary/90 transition-all mt-2">
          Log In
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

const SignupPage = ({ setView }: { setView: (v: View) => void }) => (
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

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setView('dashboard'); }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">First Name</label>
            <input 
              type="text" 
              className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none" 
              placeholder="John"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Last Name</label>
            <input 
              type="text" 
              className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none" 
              placeholder="Doe"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Email Address</label>
          <input 
            type="email" 
            className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none" 
            placeholder="name@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
          <input 
            type="password" 
            className="w-full bg-background-dark border border-white/10 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none" 
            placeholder="••••••••"
            required
          />
        </div>
        <p className="text-[10px] text-slate-500 text-center px-4">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
        <button className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:bg-primary/90 transition-all mt-2">
          Create Account
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

const Reader = ({ setView }: { setView: (v: View) => void }) => {
  const [overlayActive, setOverlayActive] = useState(true);
  
  return (
    <div className="flex h-screen overflow-hidden pt-16">
      {/* Left Sidebar */}
      <aside className="w-72 bg-surface-dark border-r border-white/10 flex flex-col shrink-0 hidden md:flex">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-white text-lg font-bold mb-1">One Piece</h2>
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <BookOpen size={14} />
            <span>Vol. 104</span>
            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
            <span>Ongoing</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 mb-1">Current Volume</div>
          <button className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-primary/20 border border-primary/30 group transition-all">
            <div className="flex flex-col gap-0.5">
              <span className="text-white text-sm font-bold">Ch 1055</span>
              <span className="text-xs text-primary/80">The New Era</span>
            </div>
            <Eye size={16} className="text-primary" />
          </button>
          {[1054, 1053, 1052].map(ch => (
            <button key={ch} className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-card-dark transition-colors border border-transparent">
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-300 text-sm font-medium">Ch {ch}</span>
                <span className="text-xs text-gray-500">Chapter Title</span>
              </div>
              <CheckCircle2 size={16} className="text-gray-600" />
            </button>
          ))}
        </div>

        <div className="h-32 bg-background-dark border-t border-white/10 p-4 shrink-0">
          <div className="text-xs font-bold text-gray-400 mb-2 flex justify-between">
            <span>Page 14 / 22</span>
            <span>65%</span>
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
          <div className="relative w-full aspect-[2/3] max-w-[800px] shadow-2xl rounded-sm overflow-hidden bg-surface-dark">
            <img 
              src="https://picsum.photos/seed/manga-page/800/1200" 
              alt="Manga Page" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Overlays */}
            {overlayActive && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-[20%] right-[15%] w-[18%] h-[12%] group cursor-help"
                >
                  <div className="text-center font-bold text-black bg-white p-2 rounded-[50%] shadow-lg text-[10px] leading-tight w-full h-full flex items-center justify-center border border-black">
                    "This power... it's overflowing!"
                  </div>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-900 text-white text-[10px] p-3 rounded-lg shadow-xl border border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="font-bold text-sm mb-1">この力...溢れてくる!</div>
                    <div className="text-gray-400 uppercase tracking-wider mb-1">Romaji</div>
                    <div className="italic text-gray-300 mb-2">Kono chikara... afurete kuru!</div>
                    <div className="text-primary flex items-center gap-1">
                      <Zap size={10} /> 98% Confidence
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute bottom-[30%] left-[10%] w-[22%] h-[15%]"
                >
                  <div className="text-center font-bold text-black bg-white p-3 rounded-[40%] shadow-lg text-xs leading-tight w-full h-full flex items-center justify-center border-2 border-black">
                    "I won't let you escape this time, Kaido!"
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="sticky bottom-6 flex items-center gap-4 bg-surface-dark/90 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 shadow-2xl z-30">
            <button className="p-2 hover:bg-white/5 rounded-full text-white transition-colors"><ChevronsLeft size={20} /></button>
            <button className="p-2 hover:bg-white/5 rounded-full text-white transition-colors"><ChevronLeft size={20} /></button>
            <span className="text-sm font-bold text-white px-2">Page 14</span>
            <button className="p-2 hover:bg-white/5 rounded-full text-white transition-colors"><ChevronRight size={20} /></button>
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

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [tasks, setTasks] = useState<Task[]>(ACTIVE_TASKS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);

  const handleSelectManga = (manga: Manga) => {
    setSelectedManga(manga);
    setView('detail');
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
      <Navbar currentView={view} setView={setView} onUpload={handleFileUpload} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      <main className="min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'landing' && <LandingPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} />}
            {view === 'dashboard' && <Dashboard setView={setView} onUpload={handleFileUpload} tasks={tasks} />}
            {view === 'reader' && <Reader setView={setView} />}
            {view === 'library' && <LibraryPage setView={setView} searchQuery={searchQuery} onSelectManga={handleSelectManga} />}
            {view === 'login' && <LoginPage setView={setView} />}
            {view === 'signup' && <SignupPage setView={setView} />}
            {view === 'detail' && selectedManga && <MangaDetailPage manga={selectedManga} setView={setView} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {view !== 'reader' && view !== 'login' && view !== 'signup' && (
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
              © 2023 MangaTranslate. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
