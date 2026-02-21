import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './src/db/supabase.js';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

// Get trending manga (from Mangadex)
app.get('/api/manga/trending', async (req, res) => {
    try {
        const url = 'https://api.mangadex.org/manga?includes[]=cover_art&order[followedCount]=desc&limit=15&hasAvailableChapters=true';
        const response = await fetch(url);
        const json = await response.json();

        if (json.data) {
            const mapped = json.data.map(mapMangadexToManga);
            return res.json(mapped);
        }
        throw new Error('No data from Mangadex');
    } catch (err) {
        console.error('Mangadex Error:', err);
        res.status(500).json({ error: 'Server error fetching trending' });
    }
});

// Search manga
app.get('/api/manga/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) return res.json([]);
        const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&includes[]=cover_art&limit=12`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.data) {
            const mapped = json.data.map(mapMangadexToManga);
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
        // Remap snake_case to camelCase
        const mapped = (data || []).map((t: any) => ({ ...t, timeRemaining: t.time_remaining }));
        return res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get history
app.get('/api/history', async (req, res) => {
    try {
        const { data, error } = await supabase.from('history').select('*').order('created_at', { ascending: false });
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

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `Provide a brief, engaging summary of the manga titled "${title}". Focus on the premise and why it's popular. Keep it under 100 words.`,
        });

        const summary = response.text || 'No summary available.';

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
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });

        return res.json({ task: { ...data, timeRemaining: data.time_remaining }, message: 'Import started' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Server error parsing URL' });
    }
});

// GET all users (Admin only, requires Service Key)
app.get('/api/admin/users', async (req, res) => {
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
app.delete('/api/admin/users/:id', async (req, res) => {
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
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch settings' });
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
        const url = `https://api.mangadex.org/manga/${id}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=100`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.data) {
            const chapters = json.data.map((c: any) => ({
                id: c.id,
                chapter: c.attributes.chapter,
                volume: c.attributes.volume,
                title: c.attributes.title
            }));
            return res.json(chapters);
        }
        return res.json([]);
    } catch (err: any) {
        console.error('Mangadex Chapter Error:', err);
        res.status(500).json({ error: 'Server error fetching chapters' });
    }
});

app.get('/api/manga/chapter/:id/pages', async (req, res) => {
    try {
        const { id } = req.params;
        const url = `https://api.mangadex.org/at-home/server/${id}`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.baseUrl && json.chapter) {
            const baseUrl = json.baseUrl;
            const hash = json.chapter.hash;
            const data = json.chapter.data; // array of filenames

            const pages = data.map((filename: string) => `${baseUrl}/data/${hash}/${filename}`);
            return res.json(pages);
        }
        return res.json([]);
    } catch (err: any) {
        console.error('Mangadex Pages Error:', err);
        res.status(500).json({ error: 'Server error fetching pages' });
    }
});

app.post('/api/ai/translate', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'Image URL required' });

        if (!process.env.GEMINI_API_KEY) {
            return res.status(401).json({ error: 'Gemini API Key missing' });
        }

        const imageRes = await fetch(imageUrl);
        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const prompt = `You are a professional manga translator. Analyze this manga page and identify all the text bubbles. Extract the original Japanese text and provide a natural English translation for each bubble. 
Return ONLY a valid JSON array of objects in this exact format: [{"original": "こんにちは", "translated": "Hello"}] - No markdown formatting, just the raw JSON.`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: prompt }
                    ]
                }
            ]
        });

        let text = response.text || '[]';
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const translations = JSON.parse(text);

        res.json({ translations });

    } catch (err: any) {
        console.error('Translation error:', err);
        const msg = err?.message || '';
        if (err?.status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
            return res.status(429).json({ error: 'Gemini API quota exceeded. Enable billing at https://ai.google.dev or wait and retry.' });
        }
        res.status(500).json({ error: 'Failed to translate image' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
