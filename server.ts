import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './src/db/supabase.js';
import { fetchMangaChapters, fetchPageImages, fetchMangaMetadata, searchMangaUrl } from './src/services/mangaProvider.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });

// ---- Server-side In-Memory Cache (10 min TTL) ----
const apiCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;
function getCached(key: string) {
    const entry = apiCache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return null;
}
function setCache(key: string, data: any) {
    apiCache.set(key, { data, ts: Date.now() });
}

// Mangadex genre name → UUID (seeded in DB, hardcoded for fast lookup)
const GENRE_TAG_MAP: Record<string, string> = {
    'Action': '391b0423-d847-456f-aff0-8b0cfc03066b',
    'Romance': '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
    'Comedy': '4d32cc48-9f00-4cca-9b5a-a839f0764984',
    'Horror': 'cdad7e68-1419-41dd-bdce-27753074a640',
    'Fantasy': 'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
    'Sci-Fi': '256c8bd9-4904-4360-bf4f-508a76d67183',
    'Slice of Life': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
    'Mystery': 'ee968100-4191-4968-93d3-f82d72be7e46',
    'Drama': 'b9af3a63-f058-46de-a9a0-e0c13906197a',
    'Sports': '69964a64-2f90-4d33-beeb-f3ed2875eb4c',
    'Adventure': '87cc87cd-a395-47af-b27a-93258283bbc6',
    'Supernatural': 'eabc5b4c-6aff-42f3-b657-3e90cbd00b75',
    'Psychological': '3b60b75c-a2d7-4860-ab56-05f391bb889c',
    'Historical': '33771934-028e-4cb3-8744-691e866a923e',
};
function buildTagParams(genres: string): string {
    return genres.split(',').map(g => g.trim()).filter(g => GENRE_TAG_MAP[g])
        .map(g => `&includedTags[]=${GENRE_TAG_MAP[g]}`).join('');
}

const mapMangadexToManga = (m: any) => {
    const title = m.attributes.title.en || Object.values(m.attributes.title)[0] || 'Unknown';
    const coverRel = m.relationships.find((r: any) => r.type === 'cover_art');
    const coverFile = coverRel?.attributes?.fileName;
    const coverUrl = coverFile ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}` : 'https://picsum.photos/400/600';

    const genre = m.attributes.tags
        .filter((t: any) => t.attributes?.group === 'genre')
        .map((t: any) => t.attributes?.name?.en)
        .filter(Boolean).slice(0, 3);

    return {
        id: m.id,
        title,
        cover: coverUrl,
        genre: genre.length ? genre : ['Manga'],
        rating: (Math.random() * (5 - 3.5) + 3.5).toFixed(1), // Mock rating, Mangadex requires separate API call for stats
        status: m.attributes.status ? m.attributes.status.charAt(0).toUpperCase() + m.attributes.status.slice(1) : 'Ongoing'
    };
};

// Cover proxy — pipes Mangadex CDN images with correct Referer header
app.get('/api/cover-proxy', async (req, res) => {
    try {
        const targetUrl = req.query.url as string;
        if (!targetUrl) return res.status(400).send('URL required');
        const cacheKey = `cover:${targetUrl}`;
        const cached = getCached(cacheKey);
        if (cached) {
            res.setHeader('Content-Type', cached.contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(cached.buffer);
        }
        const imgRes = await fetch(targetUrl, { headers: { 'Referer': 'https://mangadex.org' } });
        if (!imgRes.ok) return res.status(imgRes.status).send('Image fetch failed');
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        setCache(cacheKey, { buffer, contentType });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
    } catch (err: any) {
        res.status(500).json({ error: 'Proxy error' });
    }
});

// Get trending manga (from Mangadex, with optional genre filter + server cache)
app.get('/api/manga/trending', async (req, res) => {
    try {
        const genres = (req.query.genres as string) || '';
        const cacheKey = `trending:${genres}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const tagParams = genres ? buildTagParams(genres) : '';
        const url = `https://api.mangadex.org/manga?includes[]=cover_art&order[followedCount]=desc&limit=20&hasAvailableChapters=true${tagParams}`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.data) {
            const mapped = json.data.map(mapMangadexToManga);
            setCache(cacheKey, mapped);
            return res.json(mapped);
        }
        throw new Error('No data from Mangadex');
    } catch (err) {
        console.error('Mangadex Error:', err);
        res.status(500).json({ error: 'Server error fetching trending' });
    }
});

// Search manga (with optional genre filter + cache)
app.get('/api/manga/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        const genres = (req.query.genres as string) || '';
        if (!query && !genres) return res.json([]);
        const cacheKey = `search:${query}:${genres}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const tagParams = genres ? buildTagParams(genres) : '';
        const titleParam = query ? `&title=${encodeURIComponent(query)}` : '';
        const url = `https://api.mangadex.org/manga?includes[]=cover_art&limit=18${titleParam}${tagParams}&hasAvailableChapters=true`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.data) {
            const mapped = json.data.map(mapMangadexToManga);
            setCache(cacheKey, mapped);
            return res.json(mapped);
        }
        return res.json([]);
    } catch (err) {
        console.error('Mangadex Search Error:', err);
        res.status(500).json({ error: 'Server error during search' });
    }
});

// Get active tasks
app.get('/api/tasks/active', async (req, res) => {
    try {
        const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        if (error) {
            return res.json([
                { id: 't1', title: 'One Piece', chapter: 'Chapters 1092-1095', status: 'Scraping', progress: 45, cover: 'https://picsum.photos/seed/op/100/150', timeRemaining: '2m' },
            ]);
        }

        const authHeader = req.headers.authorization;
        let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                query = query.eq('user_id', user.id);
            }
        }

        const { data: tasks, error: taskError } = await query;
        if (taskError) throw taskError;

        // Remap snake_case to camelCase
        const mapped = (tasks || []).map((t: any) => ({ ...t, timeRemaining: t.time_remaining }));
        return res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get history
app.get('/api/history', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let query = supabase.from('history').select('*').order('created_at', { ascending: false });

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                query = query.eq('user_id', user.id);
            }
        }

        const { data, error } = await query;
        if (error) {
            return res.json([
                { id: 'h1', title: 'Chainsaw Man', chapter: 'Ch. 142', source: 'Mangadex', date: 'Oct 24, 2023', status: 'Completed', cover: 'https://picsum.photos/seed/csm/80/100' },
            ]);
        }
        return res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Generate Summary via Gemini API (with Supabase caching)
app.post('/api/ai/summary', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'Title required' });

        // Check Supabase cache first
        const { data: cached } = await supabase
            .from('manga')
            .select('ai_summary')
            .eq('title', title)
            .single();

        if (cached?.ai_summary) {
            return res.json({ summary: cached.ai_summary, cached: true });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(401).json({ error: 'Gemini API Key missing' });
        }

        const response = await aiModel.generateContent(`Provide a brief, engaging summary of the manga titled "${title}". Focus on the premise and why it's popular. Keep it under 100 words.`);
        const summary = response.response.text() || 'No summary available.';

        // Cache it in Supabase
        await supabase.from('manga').update({ ai_summary: summary }).eq('title', title);

        return res.json({ summary, cached: false });
    } catch (err: any) {
        console.error('Gemini error:', err);
        const msg = err?.message || '';
        if (err?.status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
            return res.status(429).json({ error: 'Gemini API quota exceeded. Enable billing at https://ai.google.dev or wait and retry.' });
        }
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

// Library Routes
app.get('/api/library', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Auth required' });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const { data, error } = await supabase
            .from('library')
            .select('manga_id, manga_title, manga_cover, manga_genre, manga_rating, manga_status, is_favorite, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mangaList = (data || []).map((item: any) => ({
            id: item.manga_id,
            title: item.manga_title,
            cover: item.manga_cover,
            genre: item.manga_genre || [],
            rating: item.manga_rating,
            status: item.manga_status,
            isFavorite: item.is_favorite || false,
        }));

        res.json(mangaList);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { mangaId, title, cover, genre, rating, status, isFavorite } = req.body;
        if (!authHeader || !mangaId) return res.status(400).json({ error: 'Data missing' });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

        const { error } = await supabase.from('library').upsert({
            user_id: user.id,
            manga_id: mangaId,
            manga_title: title || 'Unknown',
            manga_cover: cover || '',
            manga_genre: genre || [],
            manga_rating: String(rating || ''),
            manga_status: status || 'Unknown',
            is_favorite: isFavorite || false,
        }, { onConflict: 'user_id,manga_id', ignoreDuplicates: false });

        if (error) {
            console.error('Library insert error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true });
    } catch (err: any) {
        console.error('Library POST error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Toggle favorite status
app.patch('/api/library/:mangaId/favorite', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Auth required' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

        const { mangaId } = req.params;
        const { isFavorite } = req.body;

        const { error } = await supabase.from('library')
            .update({ is_favorite: isFavorite })
            .eq('user_id', user.id)
            .eq('manga_id', mangaId);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, isFavorite });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Delete from library
app.delete('/api/library/:mangaId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Auth required' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

        const { error } = await supabase.from('library')
            .delete()
            .eq('user_id', user.id)
            .eq('manga_id', req.params.mangaId);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Read Progress Routes
app.get('/api/progress/:mangaId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.json(null);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return res.json(null);

        const { data } = await supabase
            .from('read_progress')
            .select('chapter_id, chapter_number, page_index, total_pages, manga_title')
            .eq('user_id', user.id)
            .eq('manga_id', req.params.mangaId)
            .single();

        res.json(data || null);
    } catch (err: any) {
        res.json(null);
    }
});

app.post('/api/progress', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Auth required' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

        const { mangaId, mangaTitle, chapterId, chapterNumber, pageIndex, totalPages } = req.body;

        const { error } = await supabase.from('read_progress').upsert({
            user_id: user.id,
            manga_id: mangaId,
            manga_title: mangaTitle || '',
            chapter_id: chapterId,
            chapter_number: String(chapterNumber || ''),
            page_index: pageIndex || 0,
            total_pages: totalPages || 0,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,manga_id' });

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});



// URL import — creates a new task in Supabase
app.post('/api/import/url', async (req, res) => {
    try {
        const { url, chapterStart, chapterEnd } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        let title = 'Unknown Manga';
        let cover = 'https://picsum.photos/seed/manga/100/150';

        // Try extracting Mangadex UUID: e.g. https://mangadex.org/title/8f226870-20ce-43fe-a8c4-cbf497ed7df9
        const uuidMatch = url.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
        if (uuidMatch) {
            const uuid = uuidMatch[0];
            try {
                const mdRes = await fetch(`https://api.mangadex.org/manga/${uuid}?includes[]=cover_art`);
                const mdJson = await mdRes.json();
                if (mdJson.data) {
                    const mapped = mapMangadexToManga(mdJson.data);
                    title = mapped.title;
                    cover = mapped.cover;
                }
            } catch (ignored) { }
        } else if (url.includes('mangakakalot.com') || url.includes('manganato.com')) {
            try {
                const meta = await fetchMangaMetadata(url);
                title = meta.title;
                cover = meta.cover;
            } catch (err) {
                console.error('Scraper metadata error:', err);
            }
        }

        const authHeader = req.headers.authorization;
        let user = null;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user: authUser } } = await supabase.auth.getUser(token);
            user = authUser;
        }

        if (title === 'Unknown Manga') {
            const urlParts = url.split('/').filter(Boolean);
            title = urlParts[urlParts.length - 1]?.replace(/-/g, ' ') || 'Unknown Manga';
            cover = `https://picsum.photos/seed/${encodeURIComponent(title)}/100/150`;
        }

        const chapter = chapterStart && chapterEnd
            ? `Chapters ${chapterStart}-${chapterEnd}`
            : chapterStart ? `Chapter ${chapterStart}` : 'Full Series';

        const { data, error } = await supabase.from('tasks').insert({
            title,
            chapter,
            status: 'Scraping',
            progress: 0,
            cover,
            time_remaining: 'Calculating...',
            user_id: user?.id || null
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });

        return res.json({ task: { ...data, timeRemaining: data.time_remaining }, message: 'Import started' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Server error parsing URL' });
    }
});

// Helper to verify Admin status
const verifyAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Auth required' });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Invalid token');

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || profile?.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        next();
    } catch (err: any) {
        res.status(401).json({ error: err.message });
    }
};

// GET all users (Admin only)
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        // We get profiles directly which has references to auth.users, but we might want emails.
        // The easiest way is to use Supabase admin API for users and join locally with profiles, 
        // or just rely on profiles table if emails aren't strictly needed.
        // Let's get auth users from admin API (needs service_role key)
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;

        const { data: profiles, error: profileError } = await supabase.from('profiles').select('*');
        if (profileError) throw profileError;

        const merged = users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            profile: profiles.find(p => p.id === u.id) || { username: 'Unknown', role: 'user', favorite_tags: [] }
        }));

        res.json(merged);
    } catch (err: any) {
        console.error('Admin API Error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch users' });
    }
});

// DELETE user (Admin only)
app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'User ID required' });

        const { error } = await supabase.auth.admin.deleteUser(id);
        if (error) throw error;

        res.json({ success: true, message: 'User deleted' });
    } catch (err: any) {
        console.error('Admin Delete Error:', err);
        res.status(500).json({ error: err.message || 'Failed to delete user' });
    }
});

// Site Settings
app.get('/api/settings', async (req, res) => {
    try {
        const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
        if (error || !data) {
            // Provide safe defaults so frontend doesn't crash if DB is unseeded
            return res.json({
                primary_color: '#ef4444',
                background_dark: '#0f1115',
                theme_mode: 'dark'
            });
        }
        res.json(data);
    } catch (err: any) {
        res.json({
            primary_color: '#ef4444',
            background_dark: '#0f1115',
            theme_mode: 'dark'
        });
    }
});

app.post('/api/admin/settings', async (req, res) => {
    try {
        const { primary_color, background_dark, theme_mode } = req.body;
        const { error } = await supabase.from('site_settings').update({ primary_color, background_dark, theme_mode }).eq('id', 1);
        if (error) throw error;
        res.json({ success: true, message: 'Settings saved' });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to update settings' });
    }
});

// Mangadex Reader proxy routes
app.get('/api/manga/:id/chapters', async (req, res) => {
    try {
        const { id } = req.params;
        const title = req.query.title as string || '';
        const source = req.query.source as string || 'mangadex';

        if (source === 'mangakakalot') {
            const { Manga } = await import('mangascrape');
            const searchResults = await Manga.search(title, { provider: 'mangakakalot' });
            if (searchResults && searchResults.length > 0) {
                const manga = searchResults[0];
                const chapters = await manga.getChapters();
                return res.json(chapters.map((ch: any) => ({
                    id: ch.url, // Use URL as ID for scraping
                    chapter: ch.chapter,
                    title: ch.title,
                    language: 'en'
                })));
            }
            return res.json([]);
        }

        const langPriority = ['en', 'ja', 'ko', 'zh', 'zh-hk', 'zh-ro', 'fr', 'es', 'pt-br', 'ru'];
        const langs = langPriority;
        const langQuery = langs.map(l => `translatedLanguage[]=${l}`).join('&');
        const ratingsQuery = 'contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic';

        const fetchChaptersForId = async (mangaId: string) => {
            const url = `https://api.mangadex.org/manga/${mangaId}/feed?${langQuery}&${ratingsQuery}&order[chapter]=asc&limit=500`;
            const response = await fetch(url);
            const json = await response.json();
            return json;
        };

        const buildChapterList = (json: any) => {
            if (!json.data || json.data.length === 0) return [];
            const chapterMap = new Map<string, any>();
            json.data.forEach((c: any) => {
                const chapNum = c.attributes.chapter;
                const chapLang = c.attributes.translatedLanguage;

                // Filter out non-numbered chapters and 'Chapter 0' (prologues/promos)
                if (!chapNum || chapNum === "0" || chapNum === "0.0") return;

                if (!chapterMap.has(chapNum)) {
                    chapterMap.set(chapNum, c);
                } else {
                    const existingLang = chapterMap.get(chapNum).attributes.translatedLanguage;
                    const newPriority = langPriority.indexOf(chapLang);
                    const existingPriority = langPriority.indexOf(existingLang);
                    if (existingPriority === -1 || (newPriority !== -1 && newPriority < existingPriority)) {
                        chapterMap.set(chapNum, c);
                    }
                }
            });
            return Array.from(chapterMap.values())
                .sort((a, b) => parseFloat(a.attributes.chapter) - parseFloat(b.attributes.chapter))
                .map((c: any) => ({
                    id: c.id,
                    chapter: c.attributes.chapter,
                    volume: c.attributes.volume,
                    title: c.attributes.title,
                    language: c.attributes.translatedLanguage
                }));
        };

        // 1. Try the provided ID first
        let json = await fetchChaptersForId(id);
        let chapters = buildChapterList(json);

        // 2. If no chapters found AND we have a title, search MangaDex by title to get the CORRECT ID
        if (chapters.length === 0 && title) {
            console.log(`[Chapters] Stored ID "${id}" returned 0 chapters. Searching by title: "${title}"`);
            const searchRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5`);
            const searchData = await searchRes.json();
            if (searchData.data?.length > 0) {
                const correctId = searchData.data[0].id;
                if (correctId !== id) {
                    console.log(`[Chapters] Found correct ID: ${correctId} (stored was ${id})`);
                    json = await fetchChaptersForId(correctId);
                    chapters = buildChapterList(json);
                }
            }
        }

        return res.json(chapters);
    } catch (err: any) {
        console.error('Mangadex Chapter Error:', err);
        res.status(500).json({ error: 'Server error fetching chapters' });
    }
});


app.get('/api/manga/chapter/:id/pages', async (req, res) => {
    try {
        const { id: chapterIdOrUrl } = req.params;
        const source = req.query.source as string || 'mangadex';

        if (source === 'mangakakalot' || chapterIdOrUrl.includes('http')) {
            const { Manga } = await import('mangascrape');
            const pages = await Manga.getPages(chapterIdOrUrl, { provider: 'mangakakalot' });
            return res.json(pages);
        }

        const url = `https://api.mangadex.org/at-home/server/${chapterIdOrUrl}`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.baseUrl && json.chapter) {
            const baseUrl = json.baseUrl;
            const hash = json.chapter.hash;
            const data = json.chapter.data;
            const dataSaver = json.chapter.dataSaver;

            // Use full quality images, fall back to data saver if stripped
            if (data && data.length > 0) {
                const pages = data.map((filename: string) => `${baseUrl}/data/${hash}/${filename}`);
                return res.json(pages);
            } else if (dataSaver && dataSaver.length > 0) {
                const pages = dataSaver.map((filename: string) => `${baseUrl}/data-saver/${hash}/${filename}`);
                return res.json(pages);
            }
        }

        // --- 0-PAGES FALLBACK: Scrape Alternates ---
        console.log(`[Pages] MangaDex returned 0 pages for chapter ${id}. Engaging alternative fallback...`);
        try {
            // 1. Get Chapter Metadata
            const chRes = await fetch(`https://api.mangadex.org/chapter/${id}?includes[]=manga`);
            const chJson = await chRes.json();
            const chapNum = chJson.data?.attributes?.chapter;
            const mangaRel = chJson.data?.relationships?.find((r: any) => r.type === 'manga');
            if (!chapNum || !mangaRel) throw new Error('Could not find chapter number or manga relation');

            // 2. Get Manga Title
            const mRes = await fetch(`https://api.mangadex.org/manga/${mangaRel.id}`);
            const mJson = await mRes.json();
            const titleObj = mJson.data?.attributes?.title;
            const title = titleObj?.en || Object.values(titleObj || {})[0];
            if (!title) throw new Error('Could not find manga title');

            console.log(`[Pages Fallback] Searching MangaDex Community for "${title}" chapter ${chapNum}...`);

            // 3. Search and Scrape Alternate
            const scrapedChapters = await fetchMangaChapters(title as string);
            const targetChap = scrapedChapters.find((c: any) => c.chapter === String(chapNum));
            if (!targetChap) throw new Error(`Alternative upload for Chapter ${chapNum} not found`);

            const scrapedPages = await fetchPageImages(targetChap.url);
            console.log(`[Pages Fallback] Success! Found ${scrapedPages.length} pages.`);
            return res.json(scrapedPages);

        } catch (fallbackErr: any) {
            console.error('[Pages Fallback] Failed:', fallbackErr.message);
        }

        return res.json([]);
    } catch (err: any) {
        console.error('Mangadex Pages Error:', err);
        res.status(500).json({ error: 'Server error fetching pages' });
    }
});

// Alternative Scraper Routes (fallback when MangaDex API blocks a title)
app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query as { title?: string };
        if (!title) return res.json([]);

        console.log(`[Scraper] Searching MangaDex Community for: "${title}"`);

        const chapters = await fetchMangaChapters(title);
        res.json(chapters);
    } catch (err: any) {
        console.error('[Scraper] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/scrape/pages', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL required' });
        const pages = await fetchPageImages(url as string);
        res.json(pages);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

import Tesseract from 'tesseract.js';
import { spawn } from 'child_process';

app.post('/api/ai/translate', async (req, res) => {
    try {
        const { imageUrl, targetLanguage = 'English' } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'Image URL required' });

        // 1. Fetch image with appropriate headers
        const imageRes = await fetch(imageUrl, {
            headers: { 'Referer': 'https://mangadex.org', 'User-Agent': 'Mozilla/5.0' }
        });
        if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. OCR with Tesseract — extract words with bounding boxes
        const { data } = await Tesseract.recognize(buffer, 'eng+jpn+chi_sim+kor');
        const ocrData = data as any;

        if (!ocrData.words || ocrData.words.length === 0) {
            return res.json({ translations: [], targetLanguage });
        }

        // 3. Group nearby words into text blocks (lines)
        const blocks: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] = [];
        let currentBlock = { text: '', bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } };

        for (const word of ocrData.words) {
            // Filter noise: skip low confidence AND very small boxes (specks)
            const wb = word.bbox;
            const width = wb.x1 - wb.x0;
            const height = wb.y1 - wb.y0;

            if (word.confidence < 70) continue; // Higher confidence threshold
            if (width < 5 || height < 5) continue; // Filter out tiny specks

            if (!currentBlock.text) {
                currentBlock = { text: word.text, bbox: { ...wb } };
            } else {
                // If word is close to current block vertically AND horizontally, merge
                const verticalGap = Math.abs(wb.y0 - currentBlock.bbox.y0);
                const horizontalGap = wb.x0 - currentBlock.bbox.x1;
                const lineHeight = currentBlock.bbox.y1 - currentBlock.bbox.y0;

                // Merge if it's on the same line/box conceptually (not across the entire page)
                if (verticalGap < lineHeight * 1.5 && horizontalGap > -lineHeight && horizontalGap < lineHeight * 3) {
                    currentBlock.text += ' ' + word.text;
                    currentBlock.bbox.x0 = Math.min(currentBlock.bbox.x0, wb.x0);
                    currentBlock.bbox.y0 = Math.min(currentBlock.bbox.y0, wb.y0);
                    currentBlock.bbox.x1 = Math.max(currentBlock.bbox.x1, wb.x1);
                    currentBlock.bbox.y1 = Math.max(currentBlock.bbox.y1, wb.y1);
                } else {
                    blocks.push(currentBlock);
                    currentBlock = { text: word.text, bbox: { ...wb } };
                }
            }
        }
        if (currentBlock.text) blocks.push(currentBlock);

        if (blocks.length === 0) {
            return res.json({ translations: [], targetLanguage });
        }

        // 4. Language code mapping
        const langMap: Record<string, string> = {
            'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de',
            'Russian': 'ru', 'Chinese (Simplified)': 'zh-CN', 'Japanese': 'ja',
            'Korean': 'ko', 'Italian': 'it', 'Portuguese': 'pt', 'Indonesian': 'id'
        };
        const targetCode = langMap[targetLanguage] || 'en';

        // 5. Translate each block using Python bridge (Deep Translator)
        try {
            const inputTexts = blocks.map(b => b.text);
            const pythonBridge = spawn('python', ['translate_bridge.py']);

            let outputChunks: Buffer[] = [];
            pythonBridge.stdout.on('data', (chunk) => {
                outputChunks.push(chunk);
            });

            pythonBridge.stdin.write(JSON.stringify({
                texts: inputTexts,
                target_lang: targetCode
            }));
            pythonBridge.stdin.end();

            await new Promise((resolve) => {
                pythonBridge.on('close', resolve);
            });

            const outputData = Buffer.concat(outputChunks).toString('utf-8');
            const translatedTexts = JSON.parse(outputData || '[]');

            const translations = blocks.map((block, i) => ({
                original: block.text,
                translated: translatedTexts[i] || block.text,
                x: block.bbox.x0,
                y: block.bbox.y0,
                width: block.bbox.x1 - block.bbox.x0,
                height: block.bbox.y1 - block.bbox.y0
            }));

            res.json({ translations, targetLanguage });
        } catch (pyErr) {
            console.error('Python Bridge Error:', pyErr);
            // Fallback: return untranslated blocks if bridge fails
            const translations = blocks.map(block => ({
                original: block.text,
                translated: block.text,
                x: block.bbox.x0,
                y: block.bbox.y0,
                width: block.bbox.x1 - block.bbox.x0,
                height: block.bbox.y1 - block.bbox.y0
            }));
            res.json({ translations, targetLanguage });
        }
    } catch (err: any) {
        console.error('Translation pipeline error:', err?.message);
        res.status(500).json({ error: 'Translation failed', details: err?.message });
    }
});

// New Endpoint: Translate pre-extracted text strings only
app.post('/api/ai/translate-only', async (req, res) => {
    try {
        console.log("== TRANSLATE ENDPOINT TRIGGERED ==");
        console.log("Request body:", req.body);
        const { texts, targetLanguage, sourceLanguage } = req.body;
        if (!texts || !Array.isArray(texts)) {
            console.log("Abort: No texts array found");
            return res.json({ translations: [] });
        }

        const langMap: Record<string, string> = {
            'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de',
            'Russian': 'ru', 'Chinese (Simplified)': 'zh-CN', 'Japanese': 'ja',
            'Korean': 'ko', 'Italian': 'it', 'Portuguese': 'pt', 'Indonesian': 'id'
        };
        const targetCode = langMap[targetLanguage] || 'en';
        console.log(`Resolved targetCode: ${targetCode} from ${targetLanguage}`);

        const pythonBridge = spawn('python', ['translate_bridge.py']);
        let resultData = '';

        pythonBridge.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        let errorData = '';
        pythonBridge.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        const pythonPayload = JSON.stringify({
            mode: 'translate',
            texts: texts,
            target_lang: targetCode,
            source: sourceLanguage || 'auto'
        });
        console.log("Sending to python:", pythonPayload);
        pythonBridge.stdin.write(pythonPayload + '\n');
        pythonBridge.stdin.end();

        await new Promise((resolve) => {
            pythonBridge.on('close', resolve);
        });

        console.log("Python STDOUT:", resultData);
        console.log("Python STDERR:", errorData);

        if (!resultData.trim()) {
            console.error('Empty response from python bridge. Stderr:', errorData);
            return res.json({ translations: [] });
        }

        try {
            const translatedTexts = JSON.parse(resultData);
            console.log("Final translated array:", translatedTexts);
            res.json({ translations: translatedTexts });
        } catch (e) {
            console.error('JSON Parse error on translation output:', resultData, errorData);
            res.json({ translations: [] });
        }
    } catch (err: any) {
        console.error('Translate-only error:', err?.message);
        res.status(500).json({ error: 'Translation failed' });
    }
});

// New Endpoint: PaddleOCR via Python Bridge
app.post('/api/ai/ocr-paddle', async (req, res) => {
    try {
        const { url, lang } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const { spawn } = await import('child_process');
        const pythonProcess = spawn('python', ['translate_bridge.py']);

        let resultData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.stdin.write(JSON.stringify({
            mode: 'ocr',
            url,
            lang: lang || 'Japanese' // Default for manga
        }));
        pythonProcess.stdin.end();

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('OCR Python process exited with code', code, errorData);
                return res.status(500).json({ error: 'OCR process failed', details: errorData });
            }
            try {
                const parsed = JSON.parse(resultData);
                res.json(parsed);
            } catch (err) {
                console.error('Failed to parse OCR output:', resultData);
                res.status(500).json({ error: 'Failed to parse OCR output' });
            }
        });
    } catch (err: any) {
        console.error('OCR Endpoint Error:', err);
        res.status(500).json({ error: 'Server error during OCR' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
