import axios from 'axios';
// Using a generic structure as 'mangascrape' might have specific initialization
// Based on typical scraping libraries:
import { Mangakakalot } from 'mangascrape';

export const fetchMangaChapters = async (mangaUrl) => {
    try {
        const client = new Mangakakalot();
        // Assuming the URL is a direct ID or needs to be parsed
        // The library uses client.id(mangaId)
        // We can extract the ID from the URL: e.g. https://mangakakalot.com/manga/id
        const mangaId = mangaUrl.split('/').pop();
        const detailed = await client.id(mangaId);

        if (!detailed) return [];

        return detailed.chapters.map(ch => ({
            title: ch.title,
            url: ch.url, // Note: index.js might provide 'id' or 'url'
            date: ch.date || ''
        }));
    } catch (error) {
        console.error('Error fetching chapters:', error);
        throw error;
    }
};

export const fetchPageImages = async (chapterUrl) => {
    try {
        const client = new Mangakakalot();
        // Library uses client.chapter(mangaId, chapterId)
        // We might need to split the chapterUrl to get IDs
        // Example: https://mangakakalot.com/chapter/mangaId/chapterId
        const parts = chapterUrl.split('/');
        const chapterId = parts.pop();
        const mangaId = parts.pop();

        const chapter = await client.chapter(mangaId, chapterId);
        return chapter.map(p => p.url);
    } catch (error) {
        console.error('Error fetching pages:', error);
        throw error;
    }
};
