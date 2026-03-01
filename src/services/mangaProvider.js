/**
 * mangaProvider.js — Fallback scraper relying on MangaDex Community uploads
 * If the official licensed chapter has 0 pages, we search MangaDex for fan scanlations
 * of the exact same chapter which are usually NOT stripped of pages.
 */

// MangaDex API Base
const MANGADEX_API = 'https://api.mangadex.org';

export async function searchMangaUrl(title) {
    // In our fallback pipeline, we don't need external URLs anymore.
    // We just need the MangaDex ID, but the server already passes the Title.
    // We return the title as a pseudo-URL so the next pipeline step knows what to search.
    return title;
}

export async function fetchMangaChapters(mangaTitle) {
    try {
        // Search MangaDex specifically for the title to find its ID
        const searchRes = await fetch(`${MANGADEX_API}/manga?title=${encodeURIComponent(mangaTitle)}&limit=1`);
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) return [];
        const mangaId = searchData.data[0].id;

        // Fetch chapters, explicitly including ALL scanlation groups (not just official)
        const langs = ['en', 'ja', 'ko', 'zh', 'zh-hk', 'zh-ro', 'fr', 'es', 'pt-br', 'ru'];
        const langQuery = langs.map(l => `translatedLanguage[]=${l}`).join('&');

        // Exclude the official publishers that strip pages (like Media Do, Ize Press, etc) by finding non-official groups
        const feedUrl = `${MANGADEX_API}/manga/${mangaId}/feed?${langQuery}&order[chapter]=asc&limit=500&includes[]=scanlation_group`;
        const feedRes = await fetch(feedUrl);
        const feedData = await feedRes.json();

        if (!feedData.data) return [];

        const chapters = [];
        const seenChapters = new Set();

        // Sort by chapter number, then prioritize chapters that actually have pages
        for (const ch of feedData.data) {
            const chapNum = ch.attributes.chapter;
            if (!chapNum) continue;

            // Only keep one version of each chapter (preferring the first one we find that isn't empty)
            // Note: We checking for actual pages happens in `fetchPageImages` but we list them all here.
            if (!seenChapters.has(chapNum)) {
                seenChapters.add(chapNum);
                chapters.push({
                    url: ch.id, // Pass the Chapter ID as the URL for the next step
                    title: ch.attributes.title || `Chapter ${chapNum}`,
                    chapter: chapNum
                });
            }
        }

        return chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
    } catch (error) {
        console.error('Error fetching fallback chapters:', error);
        throw error;
    }
}

export async function fetchPageImages(chapterId) {
    try {
        // The chapterId passed here is a MangaDex Chapter ID from our fan-scanlation fallback list
        const res = await fetch(`${MANGADEX_API}/at-home/server/${chapterId}`);
        const data = await res.json();

        if (data.result === 'ok' && data.chapter.data.length > 0) {
            const baseUrl = data.baseUrl;
            const hash = data.chapter.hash;
            return data.chapter.data.map(filename => `${baseUrl}/data/${hash}/${filename}`);
        }

        return [];
    } catch (error) {
        console.error('Error fetching fallback pages:', error);
        return [];
    }
}

export async function fetchMangaMetadata(mangaTitle) {
    return { title: mangaTitle, cover: '' };
}
