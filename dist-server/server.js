// server.ts
import express from "express";
import cors from "cors";
import dotenv2 from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// src/db/supabase.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
var supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
var supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key"
);

// src/services/mangaProvider.js
var MANGADEX_API = "https://api.mangadex.org";
async function fetchMangaChapters(mangaTitle) {
  try {
    const searchRes = await fetch(`${MANGADEX_API}/manga?title=${encodeURIComponent(mangaTitle)}&limit=1`);
    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) return [];
    const mangaId = searchData.data[0].id;
    const langs = ["en", "ja", "ko", "zh", "zh-hk", "zh-ro", "fr", "es", "pt-br", "ru"];
    const langQuery = langs.map((l) => `translatedLanguage[]=${l}`).join("&");
    const feedUrl = `${MANGADEX_API}/manga/${mangaId}/feed?${langQuery}&order[chapter]=asc&limit=500&includes[]=scanlation_group`;
    const feedRes = await fetch(feedUrl);
    const feedData = await feedRes.json();
    if (!feedData.data) return [];
    const chapters = [];
    const seenChapters = /* @__PURE__ */ new Set();
    for (const ch of feedData.data) {
      const chapNum = ch.attributes.chapter;
      if (!chapNum) continue;
      if (!seenChapters.has(chapNum)) {
        seenChapters.add(chapNum);
        chapters.push({
          url: ch.id,
          // Pass the Chapter ID as the URL for the next step
          title: ch.attributes.title || `Chapter ${chapNum}`,
          chapter: chapNum
        });
      }
    }
    return chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
  } catch (error) {
    console.error("Error fetching fallback chapters:", error);
    throw error;
  }
}
async function fetchPageImages(chapterId) {
  try {
    const res = await fetch(`${MANGADEX_API}/at-home/server/${chapterId}`);
    const data = await res.json();
    if (data.result === "ok" && data.chapter.data.length > 0) {
      const baseUrl = data.baseUrl;
      const hash = data.chapter.hash;
      return data.chapter.data.map((filename) => `${baseUrl}/data/${hash}/${filename}`);
    }
    return [];
  } catch (error) {
    console.error("Error fetching fallback pages:", error);
    return [];
  }
}
async function fetchMangaMetadata(mangaTitle) {
  return { title: mangaTitle, cover: "" };
}

// server.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import Tesseract from "tesseract.js";
import { spawn } from "child_process";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
dotenv2.config();
var { Pool } = pg;
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var app = express();
var rawOrigin = process.env.FRONTEND_URL || "*";
var cleanOrigin = rawOrigin !== "*" ? rawOrigin.replace(/\/+$/, "") : "*";
var corsOptions = {
  origin: cleanOrigin === "*" ? "*" : [cleanOrigin, `${cleanOrigin}/`],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/health", async (req, res) => {
  let internet = false;
  try {
    const test = await fetch("https://www.google.com", { signal: AbortSignal.timeout(2e3) });
    internet = test.ok;
  } catch (e) {
    internet = false;
  }
  res.json({
    status: "ok",
    uptime: process.uptime(),
    internet,
    distFound: fs.existsSync(path.join(__dirname, "dist")) || fs.existsSync(path.join(__dirname, "..", "dist")),
    dirname: __dirname,
    env: {
      supabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabaseKey: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
      geminiKey: !!process.env.GEMINI_API_KEY,
      port: process.env.PORT
    }
  });
});
var genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
var aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
var apiCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 10 * 60 * 1e3;
function getCached(key) {
  const entry = apiCache.get(key);
  if (!entry) return null;
  const ttl = entry.ttl ? entry.ttl * 1e3 : CACHE_TTL;
  if (Date.now() - entry.ts < ttl) return entry.data;
  apiCache.delete(key);
  return null;
}
function setCache(key, data, ttlSeconds) {
  apiCache.set(key, { data, ts: Date.now(), ttl: ttlSeconds });
}
var GENRE_TAG_MAP = {
  "Action": "391b0423-d847-456f-aff0-8b0cfc03066b",
  "Romance": "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
  "Comedy": "4d32cc48-9f00-4cca-9b5a-a839f0764984",
  "Horror": "cdad7e68-1419-41dd-bdce-27753074a640",
  "Fantasy": "cdc58593-87dd-415e-bbc0-2ec27bf404cc",
  "Sci-Fi": "256c8bd9-4904-4360-bf4f-508a76d67183",
  "Slice of Life": "e5301a23-ebd9-49dd-a0cb-2add944c7fe9",
  "Mystery": "ee968100-4191-4968-93d3-f82d72be7e46",
  "Drama": "b9af3a63-f058-46de-a9a0-e0c13906197a",
  "Sports": "69964a64-2f90-4d33-beeb-f3ed2875eb4c",
  "Adventure": "87cc87cd-a395-47af-b27a-93258283bbc6",
  "Supernatural": "eabc5b4c-6aff-42f3-b657-3e90cbd00b75",
  "Psychological": "3b60b75c-a2d7-4860-ab56-05f391bb889c",
  "Historical": "33771934-028e-4cb3-8744-691e866a923e"
};
function buildTagParams(genres) {
  return genres.split(",").map((g) => g.trim()).filter((g) => GENRE_TAG_MAP[g]).map((g) => `&includedTags[]=${GENRE_TAG_MAP[g]}`).join("");
}
var mapMangadexToManga = (m) => {
  const title = m.attributes.title.en || Object.values(m.attributes.title)[0] || "Unknown";
  const coverRel = m.relationships.find((r) => r.type === "cover_art");
  const coverFile = coverRel?.attributes?.fileName;
  const coverUrl = coverFile ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}` : "https://picsum.photos/400/600";
  const genre = m.attributes.tags.filter((t) => t.attributes?.group === "genre").map((t) => t.attributes?.name?.en).filter(Boolean).slice(0, 3);
  const descObj = m.attributes.description || {};
  const description = descObj.en || Object.values(descObj)[0] || "";
  return {
    id: m.id,
    title,
    cover: coverUrl,
    genre: genre.length ? genre : ["Manga"],
    rating: "0",
    // Will be enriched with real stats below
    status: m.attributes.status ? m.attributes.status.charAt(0).toUpperCase() + m.attributes.status.slice(1) : "Ongoing",
    description
  };
};
var enrichWithStats = async (items) => {
  try {
    const ids = items.map((i) => i.id);
    const params = ids.map((id) => `manga[]=${id}`).join("&");
    const statsRes = await fetch(`https://api.mangadex.org/statistics/manga?${params}`);
    const statsJson = await statsRes.json();
    if (statsJson.statistics) {
      for (const item of items) {
        const stat = statsJson.statistics[item.id];
        if (stat?.rating?.bayesian) {
          item.rating = (stat.rating.bayesian / 2).toFixed(1);
        } else if (stat?.rating?.average) {
          item.rating = (stat.rating.average / 2).toFixed(1);
        }
      }
    }
  } catch (err) {
    console.error("Stats fetch error:", err);
  }
  return items;
};
app.get("/api/cover-proxy", async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("URL required");
    const cacheKey = `cover:${targetUrl}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(cached.buffer);
    }
    const imgRes = await fetch(targetUrl, { headers: { "Referer": "https://mangadex.org" } });
    if (!imgRes.ok) return res.status(imgRes.status).send("Image fetch failed");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    setCache(cacheKey, { buffer, contentType });
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Proxy error" });
  }
});
app.get("/api/manga/trending", async (req, res) => {
  try {
    const genres = req.query.genres || "";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = 15;
    const offset = (page - 1) * pageSize;
    const cacheKey = `trending:${genres}:page${page}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const tagParams = genres ? buildTagParams(genres) : "";
    const url = `https://api.mangadex.org/manga?includes[]=cover_art&order[followedCount]=desc&limit=${pageSize}&offset=${offset}&hasAvailableChapters=true${tagParams}`;
    const response = await fetch(url);
    const json = await response.json();
    if (json.data) {
      const items = json.data.map(mapMangadexToManga);
      await enrichWithStats(items);
      const total = json.total || 1e4;
      const result = { items, total, page, pageSize };
      setCache(cacheKey, result);
      return res.json(result);
    }
    throw new Error("No data from Mangadex");
  } catch (err) {
    console.error("Mangadex Error:", err);
    res.status(500).json({ error: "Server error fetching trending" });
  }
});
app.get("/api/manga/search", async (req, res) => {
  try {
    const query = req.query.q;
    const genres = req.query.genres || "";
    if (!query && !genres) return res.json([]);
    const cacheKey = `search:${query}:${genres}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const tagParams = genres ? buildTagParams(genres) : "";
    const titleParam = query ? `&title=${encodeURIComponent(query)}` : "";
    const url = `https://api.mangadex.org/manga?includes[]=cover_art&limit=18${titleParam}${tagParams}&hasAvailableChapters=true`;
    const response = await fetch(url);
    const json = await response.json();
    if (json.data) {
      const mapped = json.data.map(mapMangadexToManga);
      await enrichWithStats(mapped);
      setCache(cacheKey, mapped);
      return res.json(mapped);
    }
    return res.json([]);
  } catch (err) {
    console.error("Mangadex Search Error:", err);
    res.status(500).json({ error: "Server error during search" });
  }
});
app.get("/api/tasks/active", async (req, res) => {
  try {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) {
      return res.json([
        { id: "t1", title: "One Piece", chapter: "Chapters 1092-1095", status: "Scraping", progress: 45, cover: "https://picsum.photos/seed/op/100/150", timeRemaining: "2m" }
      ]);
    }
    const authHeader = req.headers.authorization;
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        query = query.eq("user_id", user.id);
      }
    }
    const { data: tasks, error: taskError } = await query;
    if (taskError) throw taskError;
    const mapped = (tasks || []).map((t) => ({ ...t, timeRemaining: t.time_remaining }));
    return res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/history", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let query = supabase.from("history").select("*").order("created_at", { ascending: false });
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        query = query.eq("user_id", user.id);
      }
    }
    const { data, error } = await query;
    if (error) {
      return res.json([
        { id: "h1", title: "Chainsaw Man", chapter: "Ch. 142", source: "Mangadex", date: "Oct 24, 2023", status: "Completed", cover: "https://picsum.photos/seed/csm/80/100" }
      ]);
    }
    return res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.post("/api/ai/summary", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const { data: cached } = await supabase.from("manga").select("ai_summary").eq("title", title).single();
    if (cached?.ai_summary) {
      return res.json({ summary: cached.ai_summary, cached: true });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(401).json({ error: "Gemini API Key missing" });
    }
    const response = await aiModel.generateContent(`Provide a brief, engaging summary of the manga titled "${title}". Focus on the premise and why it's popular. Keep it under 100 words.`);
    const summary = response.response.text() || "No summary available.";
    await supabase.from("manga").update({ ai_summary: summary }).eq("title", title);
    return res.json({ summary, cached: false });
  } catch (err) {
    console.error("Gemini error:", err);
    const msg = err?.message || "";
    if (err?.status === 429 || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({ error: "Gemini API quota exceeded. Enable billing at https://ai.google.dev or wait and retry." });
    }
    res.status(500).json({ error: "Failed to generate summary" });
  }
});
app.get("/api/anime/trending", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = 15;
    const cacheKey = "anime_sanka_trending_full";
    let allAnime = getCached(cacheKey);
    if (!allAnime) {
      const response = await fetch("https://www.sankavollerei.com/anime/home");
      if (!response.ok) throw new Error(`Sanka Home Error: ${response.status}`);
      const json = await response.json();
      const ongoingRaw = json?.data?.ongoing?.animeList || json?.data?.ongoing || json?.data?.ongoingAnime || [];
      const completedRaw = json?.data?.completed?.animeList || json?.data?.completed || [];
      const ongoingList = Array.isArray(ongoingRaw) ? ongoingRaw : [];
      const completedList = Array.isArray(completedRaw) ? completedRaw : [];
      const mapAnime = (a, status) => ({
        id: a.animeId,
        title: a.title,
        cover: a.poster,
        genre: a.genreList?.map((g) => g.title) || [],
        rating: a.score || null,
        status
      });
      allAnime = [
        ...ongoingList.map((a) => mapAnime(a, "Ongoing")),
        ...completedList.map((a) => mapAnime(a, "Completed"))
      ];
      setCache(cacheKey, allAnime, 3600);
    }
    const total = allAnime.length;
    const start = (page - 1) * pageSize;
    const items = allAnime.slice(start, start + pageSize);
    res.json({ items, total, page, pageSize });
  } catch (err) {
    console.error("Anime Trending Error:", err);
    res.status(500).json({ error: "Server error fetching trending anime" });
  }
});
app.get("/api/anime/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);
    const cacheKey = `anime_sanka_search:${query.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    try {
      const url = `https://www.sankavollerei.com/anime/search/${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        if (json?.data?.animeList && json.data.animeList.length > 0) {
          setCache(cacheKey, json.data.animeList);
          return res.json(json.data.animeList);
        } else {
          console.log(`[AnimeSearch] No results on Sanka for: ${query}`);
        }
      } else {
        console.error(`[AnimeSearch] Sanka API error: ${response.status} ${response.statusText}`);
      }
    } catch (initialErr) {
      console.error("Initial Anime Search Error (Sanka):", initialErr);
    }
    try {
      const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
      const jikanJson = await jikanRes.json();
      if (jikanJson?.data && jikanJson.data.length > 0) {
        const anime = jikanJson.data[0];
        const candidates = /* @__PURE__ */ new Set();
        if (anime.title) candidates.add(anime.title);
        if (anime.title_japanese) candidates.add(anime.title_japanese);
        if (anime.title_english) candidates.add(anime.title_english);
        if (Array.isArray(anime.titles)) {
          anime.titles.forEach((t) => {
            if (t.title) candidates.add(t.title);
          });
        }
        for (const cand of candidates) {
          if (cand.toLowerCase() === query.toLowerCase()) continue;
          const fallbackUrl = `https://www.sankavollerei.com/anime/search/${encodeURIComponent(cand)}`;
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            const fallbackJson = await fallbackResponse.json();
            if (fallbackJson?.data?.animeList && fallbackJson.data.animeList.length > 0) {
              console.log(`[AnimeSearch] SUCCESS with fallback: ${cand}`);
              setCache(cacheKey, fallbackJson.data.animeList);
              return res.json(fallbackJson.data.animeList);
            }
          }
        }
      }
    } catch (fallbackErr) {
      console.error("[AnimeSearch] Jikan Fallback failure:", fallbackErr);
    }
    console.log(`[AnimeSearch] No results found for: ${query}`);
    res.json([]);
  } catch (err) {
    console.error("Anime Endpoint Error:", err);
    res.status(500).json({ error: "Server error during anime search" });
  }
});
app.get("/api/anime/details/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `anime_sanka_details:${id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const response = await fetch(`https://www.sankavollerei.com/anime/anime/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`Sanka Details Error: ${response.status}`);
    const json = await response.json();
    if (json?.data) {
      setCache(cacheKey, json.data);
      return res.json(json.data);
    }
    return res.status(404).json({ error: "Anime details not found." });
  } catch (err) {
    console.error("Anime Details Error:", err);
    res.status(500).json({ error: "Server error fetching anime details" });
  }
});
app.get("/api/anime/stream/:episodeId", async (req, res) => {
  try {
    const { episodeId } = req.params;
    const cacheKey = `anime_sanka_stream:${episodeId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const response = await fetch(`https://www.sankavollerei.com/anime/episode/${encodeURIComponent(episodeId)}`);
    if (!response.ok) {
      console.error("Sanka Episode Error Status:", response.status);
      return res.status(404).json({ error: "Episode streaming link not found. Try another source." });
    }
    const json = await response.json();
    let streamUrl = json?.data?.defaultStreamingUrl;
    if (!streamUrl && json?.data?.server?.qualities) {
      for (const quality of json.data.server.qualities) {
        if (quality.serverList && quality.serverList.length > 0) {
          const preferred = quality.serverList.find(
            (s) => s.title.toLowerCase().includes("vidhide") || s.title.toLowerCase().includes("desu") || s.title.toLowerCase().includes("filedon")
          ) || quality.serverList[0];
          if (preferred.url) {
            streamUrl = preferred.url;
            break;
          }
        }
      }
    }
    if (streamUrl) {
      const streamData = {
        streamUrl,
        type: "iframe"
      };
      setCache(cacheKey, streamData);
      return res.json(streamData);
    }
    return res.status(404).json({ error: "Failed to extract video iframe." });
  } catch (err) {
    console.error("Sanka Stream Error:", err);
    res.status(500).json({ error: "Internal server error while fetching stream." });
  }
});
app.get("/api/library", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Auth required" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Invalid token" });
    const { data, error } = await supabase.from("library").select("manga_id, manga_title, manga_cover, manga_genre, manga_rating, manga_status, is_favorite, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    const mangaList = (data || []).map((item) => ({
      id: item.manga_id,
      title: item.manga_title,
      cover: item.manga_cover,
      genre: item.manga_genre || [],
      rating: item.manga_rating,
      status: item.manga_status,
      isFavorite: item.is_favorite || false
    }));
    res.json(mangaList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/library", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { mangaId, title, cover, genre, rating, status, isFavorite } = req.body;
    if (!authHeader || !mangaId) return res.status(400).json({ error: "Data missing" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { error } = await supabase.from("library").upsert({
      user_id: user.id,
      manga_id: mangaId,
      manga_title: title || "Unknown",
      manga_cover: cover || "",
      manga_genre: genre || [],
      manga_rating: String(rating || ""),
      manga_status: status || "Unknown",
      is_favorite: isFavorite || false
    }, { onConflict: "user_id,manga_id", ignoreDuplicates: false });
    if (error) {
      console.error("Library insert error:", error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Library POST error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.patch("/api/library/:mangaId/favorite", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Auth required" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { mangaId } = req.params;
    const { isFavorite } = req.body;
    const { error } = await supabase.from("library").update({ is_favorite: isFavorite }).eq("user_id", user.id).eq("manga_id", mangaId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, isFavorite });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/library/:mangaId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Auth required" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { error } = await supabase.from("library").delete().eq("user_id", user.id).eq("manga_id", req.params.mangaId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/progress/:mangaId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.json(null);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.json(null);
    const { data } = await supabase.from("read_progress").select("chapter_id, chapter_number, page_index, total_pages, manga_title").eq("user_id", user.id).eq("manga_id", req.params.mangaId).single();
    res.json(data || null);
  } catch (err) {
    res.json(null);
  }
});
app.post("/api/progress", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Auth required" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { mangaId, mangaTitle, chapterId, chapterNumber, pageIndex, totalPages } = req.body;
    const { error } = await supabase.from("read_progress").upsert({
      user_id: user.id,
      manga_id: mangaId,
      manga_title: mangaTitle || "",
      chapter_id: chapterId,
      chapter_number: String(chapterNumber || ""),
      page_index: pageIndex || 0,
      total_pages: totalPages || 0,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id,manga_id" });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/import/url", async (req, res) => {
  try {
    const { url, chapterStart, chapterEnd } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    let title = "Unknown Manga";
    let cover = "https://picsum.photos/seed/manga/100/150";
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
      } catch (ignored) {
      }
    } else if (url.includes("mangakakalot.com") || url.includes("manganato.com")) {
      try {
        const meta = await fetchMangaMetadata(url);
        title = meta.title;
        cover = meta.cover;
      } catch (err) {
        console.error("Scraper metadata error:", err);
      }
    }
    const authHeader = req.headers.authorization;
    let user = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      user = authUser;
    }
    if (title === "Unknown Manga") {
      const urlParts = url.split("/").filter(Boolean);
      title = urlParts[urlParts.length - 1]?.replace(/-/g, " ") || "Unknown Manga";
      cover = `https://picsum.photos/seed/${encodeURIComponent(title)}/100/150`;
    }
    const chapter = chapterStart && chapterEnd ? `Chapters ${chapterStart}-${chapterEnd}` : chapterStart ? `Chapter ${chapterStart}` : "Full Series";
    const { data, error } = await supabase.from("tasks").insert({
      title,
      chapter,
      status: "Scraping",
      progress: 0,
      cover,
      time_remaining: "Calculating...",
      user_id: user?.id || null
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ task: { ...data, timeRemaining: data.time_remaining }, message: "Import started" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error parsing URL" });
  }
});
var verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Auth required" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};
app.get("/api/admin/users", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT u.id, u.email, u.created_at, p.username, p.role, p.favorite_tags
            FROM auth.users u
            LEFT JOIN public.profiles p ON u.id = p.id
            ORDER BY u.created_at DESC
        `);
    const users = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      created_at: row.created_at,
      profile: { username: row.username || "Unknown", role: row.role || "user", favorite_tags: row.favorite_tags || [] }
    }));
    res.json(users);
  } catch (err) {
    console.error("Admin API Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
});
app.delete("/api/admin/users/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "User ID required" });
    await pool.query("DELETE FROM auth.users WHERE id = $1", [id]);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Admin Delete Error:", err);
    res.status(500).json({ error: err.message || "Failed to delete user" });
  }
});
app.get("/api/settings", async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS public.site_settings (id INT PRIMARY KEY, primary_color TEXT, background_dark TEXT, theme_mode TEXT);`);
    const result = await pool.query("SELECT * FROM public.site_settings WHERE id = 1");
    if (result.rows.length === 0) {
      return res.json({ primary_color: "#ef4444", background_dark: "#0f1115", theme_mode: "dark" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.json({ primary_color: "#ef4444", background_dark: "#0f1115", theme_mode: "dark" });
  }
});
app.post("/api/admin/settings", async (req, res) => {
  try {
    const { primary_color, background_dark, theme_mode } = req.body;
    await pool.query(`CREATE TABLE IF NOT EXISTS public.site_settings (id INT PRIMARY KEY, primary_color TEXT, background_dark TEXT, theme_mode TEXT);`);
    await pool.query(`
            INSERT INTO public.site_settings (id, primary_color, background_dark, theme_mode)
            VALUES (1, $1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET
                primary_color = EXCLUDED.primary_color,
                background_dark = EXCLUDED.background_dark,
                theme_mode = EXCLUDED.theme_mode;
        `, [primary_color, background_dark, theme_mode]);
    res.json({ success: true, message: "Settings saved" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update settings" });
  }
});
app.post("/api/feedback", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let userId = null;
    let userEmail = "anonymous";
    let username = "Anonymous";
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email || "unknown";
        const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
        username = profile?.username || userEmail.split("@")[0];
      }
    }
    const { message, category } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }
    await pool.query(`
            INSERT INTO public.feedback (user_id, email, username, message, category, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, userEmail, username, message.trim(), category || "general", (/* @__PURE__ */ new Date()).toISOString()]);
    res.json({ success: true, message: "Feedback submitted!" });
  } catch (err) {
    console.error("Feedback submit error:", err);
    res.status(500).json({ error: err.message || "Failed to submit feedback" });
  }
});
app.get("/api/admin/feedback", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const result = await pool.query("SELECT * FROM public.feedback ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Feedback fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch feedback" });
  }
});
app.patch("/api/admin/feedback/:id/status", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { status } = req.body;
    if (!["unread", "read", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await pool.query("UPDATE public.feedback SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update feedback status" });
  }
});
app.delete("/api/admin/feedback/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM public.feedback WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to delete feedback" });
  }
});
app.get("/api/manga/:id/chapters", async (req, res) => {
  try {
    const { id } = req.params;
    const title = req.query.title || "";
    const source = req.query.source || "mangadex";
    if (source === "mangabuddy") {
      const { MangaBuddy } = await import("mangascrape");
      const buddy = new MangaBuddy();
      const searchResults = await buddy.search(title);
      if (searchResults && searchResults.length > 0) {
        const firstResult = searchResults[0];
        try {
          const details = await buddy.id(firstResult.id);
          return res.json(details.chapters.map((ch) => {
            const chapterNumber = ch.title.replace(/[^0-9.]/g, "") || ch.title;
            return {
              id: `${firstResult.id}||${ch.id}`,
              chapter: chapterNumber,
              title: ch.title,
              language: "en"
            };
          }));
        } catch (e) {
          console.error("MangaBuddy ID fetch error", e);
        }
      }
      return res.json([]);
    }
    const langPriority = ["en", "ja", "ko", "zh", "zh-hk", "zh-ro", "fr", "es", "pt-br", "ru"];
    const langs = langPriority;
    const langQuery = langs.map((l) => `translatedLanguage[]=${l}`).join("&");
    const ratingsQuery = "contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";
    const fetchChaptersForId = async (mangaId) => {
      const url = `https://api.mangadex.org/manga/${mangaId}/feed?${langQuery}&${ratingsQuery}&order[chapter]=asc&limit=500`;
      const response = await fetch(url);
      const json2 = await response.json();
      return json2;
    };
    const buildChapterList = (json2) => {
      if (!json2.data || json2.data.length === 0) return [];
      const chapterMap = /* @__PURE__ */ new Map();
      json2.data.forEach((c) => {
        const chapNum = c.attributes.chapter;
        const chapLang = c.attributes.translatedLanguage;
        if (!chapNum || chapNum === "0" || chapNum === "0.0") return;
        if (!chapterMap.has(chapNum)) {
          chapterMap.set(chapNum, c);
        } else {
          const existingLang = chapterMap.get(chapNum).attributes.translatedLanguage;
          const newPriority = langPriority.indexOf(chapLang);
          const existingPriority = langPriority.indexOf(existingLang);
          if (existingPriority === -1 || newPriority !== -1 && newPriority < existingPriority) {
            chapterMap.set(chapNum, c);
          }
        }
      });
      return Array.from(chapterMap.values()).sort((a, b) => parseFloat(a.attributes.chapter) - parseFloat(b.attributes.chapter)).map((c) => ({
        id: c.id,
        chapter: c.attributes.chapter,
        volume: c.attributes.volume,
        title: c.attributes.title,
        language: c.attributes.translatedLanguage
      }));
    };
    let json = await fetchChaptersForId(id);
    let chapters = buildChapterList(json);
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
  } catch (err) {
    console.error("Mangadex Chapter Error:", err);
    res.status(500).json({ error: "Server error fetching chapters" });
  }
});
app.get("/api/manga/chapter/:id/pages", async (req, res) => {
  try {
    const { id } = req.params;
    const source = req.query.source || "mangadex";
    if (source === "mangabuddy") {
      const { MangaBuddy } = await import("mangascrape");
      const buddy = new MangaBuddy();
      try {
        const [mangaId, trueChapterId] = id.split("||");
        const pages = await buddy.chapter(mangaId, trueChapterId);
        return res.json(pages);
      } catch (e) {
        console.error("MangaBuddy Chapter Fetch Error", e);
        return res.json([]);
      }
    }
    const url = `https://api.mangadex.org/at-home/server/${id}`;
    const response = await fetch(url);
    const json = await response.json();
    if (json.baseUrl && json.chapter) {
      const baseUrl = json.baseUrl;
      const hash = json.chapter.hash;
      const data = json.chapter.data;
      const dataSaver = json.chapter.dataSaver;
      if (data && data.length > 0) {
        const pages = data.map((filename) => `${baseUrl}/data/${hash}/${filename}`);
        return res.json(pages);
      } else if (dataSaver && dataSaver.length > 0) {
        const pages = dataSaver.map((filename) => `${baseUrl}/data-saver/${hash}/${filename}`);
        return res.json(pages);
      }
    }
    console.log(`[Pages] MangaDex returned 0 pages for chapter ${id}. Engaging alternative fallback...`);
    try {
      const chRes = await fetch(`https://api.mangadex.org/chapter/${id}?includes[]=manga`);
      const chJson = await chRes.json();
      const chapNum = chJson.data?.attributes?.chapter;
      const mangaRel = chJson.data?.relationships?.find((r) => r.type === "manga");
      if (!chapNum || !mangaRel) throw new Error("Could not find chapter number or manga relation");
      const mRes = await fetch(`https://api.mangadex.org/manga/${mangaRel.id}`);
      const mJson = await mRes.json();
      const titleObj = mJson.data?.attributes?.title;
      const title = titleObj?.en || Object.values(titleObj || {})[0];
      if (!title) throw new Error("Could not find manga title");
      console.log(`[Pages Fallback] Searching MangaDex Community for "${title}" chapter ${chapNum}...`);
      const scrapedChapters = await fetchMangaChapters(title);
      const targetChap = scrapedChapters.find((c) => c.chapter === String(chapNum));
      if (!targetChap) throw new Error(`Alternative upload for Chapter ${chapNum} not found`);
      const scrapedPages = await fetchPageImages(targetChap.url);
      console.log(`[Pages Fallback] Success! Found ${scrapedPages.length} pages.`);
      return res.json(scrapedPages);
    } catch (fallbackErr) {
      console.error("[Pages Fallback] Failed:", fallbackErr.message);
    }
    return res.json([]);
  } catch (err) {
    console.error("Mangadex Pages Error:", err);
    res.status(500).json({ error: "Server error fetching pages" });
  }
});
app.get("/api/manga/image-proxy", async (req, res) => {
  try {
    const urlStr = req.query.url;
    if (!urlStr) {
      return res.status(400).json({ error: "URL is required" });
    }
    const referer = urlStr.includes("mangabuddy.com") ? "https://mangabuddy.com/" : "https://mangadex.org/";
    const fetchRes = await fetch(urlStr, {
      headers: {
        "Referer": referer,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(15e3)
      // 15s timeout
    });
    if (!fetchRes.ok) {
      console.error("Proxy Image Error HTTP", fetchRes.status, "for", urlStr);
      return res.status(fetchRes.status).send("Failed to fetch image");
    }
    const contentType = fetchRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (e) {
    if (e.name === "TimeoutError") {
      console.error("Image Proxy Timeout:", req.query.url);
      return res.status(504).send("Gateway Timeout");
    }
    console.error("Image Proxy Crash:", e);
    res.status(500).send("Proxy Stream Error");
  }
});
app.get("/api/scrape/chapters", async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) return res.json([]);
    console.log(`[Scraper] Searching MangaDex Community for: "${title}"`);
    const chapters = await fetchMangaChapters(title);
    res.json(chapters);
  } catch (err) {
    console.error("[Scraper] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/scrape/pages", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });
    const pages = await fetchPageImages(url);
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "";
app.post("/api/ai/translate", async (req, res) => {
  try {
    const { imageUrl, targetLanguage = "English" } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "Image URL required" });
    const imageRes = await fetch(imageUrl, {
      headers: { "Referer": "https://mangadex.org", "User-Agent": "Mozilla/5.0" }
    });
    if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { data } = await Tesseract.recognize(buffer, "eng+jpn+chi_sim+kor");
    const ocrData = data;
    if (!ocrData.words || ocrData.words.length === 0) {
      return res.json({ translations: [], targetLanguage });
    }
    const blocks = [];
    let currentBlock = { text: "", bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } };
    for (const word of ocrData.words) {
      const wb = word.bbox;
      const width = wb.x1 - wb.x0;
      const height = wb.y1 - wb.y0;
      if (word.confidence < 70) continue;
      if (width < 5 || height < 5) continue;
      if (!currentBlock.text) {
        currentBlock = { text: word.text, bbox: { ...wb } };
      } else {
        const verticalGap = Math.abs(wb.y0 - currentBlock.bbox.y0);
        const horizontalGap = wb.x0 - currentBlock.bbox.x1;
        const lineHeight = currentBlock.bbox.y1 - currentBlock.bbox.y0;
        if (verticalGap < lineHeight * 1.5 && horizontalGap > -lineHeight && horizontalGap < lineHeight * 3) {
          currentBlock.text += " " + word.text;
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
    const langMap = {
      "English": "en",
      "Spanish": "es",
      "French": "fr",
      "German": "de",
      "Russian": "ru",
      "Chinese (Simplified)": "zh-CN",
      "Japanese": "ja",
      "Korean": "ko",
      "Italian": "it",
      "Portuguese": "pt",
      "Indonesian": "id"
    };
    const targetCode = langMap[targetLanguage] || "en";
    try {
      const inputTexts = blocks.map((b) => b.text);
      const pythonBridge = spawn("python", ["translate_bridge.py"]);
      let outputChunks = [];
      pythonBridge.stdout.on("data", (chunk) => {
        outputChunks.push(chunk);
      });
      pythonBridge.stdin.write(JSON.stringify({
        texts: inputTexts,
        target_lang: targetCode
      }));
      pythonBridge.stdin.end();
      await new Promise((resolve) => {
        pythonBridge.on("close", resolve);
      });
      const outputData = Buffer.concat(outputChunks).toString("utf-8");
      const translatedTexts = JSON.parse(outputData || "[]");
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
      console.error("Python Bridge Error:", pyErr);
      const translations = blocks.map((block) => ({
        original: block.text,
        translated: block.text,
        x: block.bbox.x0,
        y: block.bbox.y0,
        width: block.bbox.x1 - block.bbox.x0,
        height: block.bbox.y1 - block.bbox.y0
      }));
      res.json({ translations, targetLanguage });
    }
  } catch (err) {
    console.error("Translation pipeline error:", err?.message);
    res.status(500).json({ error: "Translation failed", details: err?.message });
  }
});
app.post("/api/ai/translate-only", async (req, res) => {
  try {
    const { texts, targetLanguage, sourceLanguage } = req.body;
    if (!texts || !Array.isArray(texts)) {
      return res.json({ translations: [] });
    }
    const langMap = {
      "English": "en",
      "Spanish": "es",
      "French": "fr",
      "German": "de",
      "Russian": "ru",
      "Chinese (Simplified)": "zh-CN",
      "Japanese": "ja",
      "Korean": "ko",
      "Italian": "it",
      "Portuguese": "pt",
      "Indonesian": "id"
    };
    const targetCode = langMap[targetLanguage] || "en";
    if (OCR_SERVICE_URL) {
      try {
        const remoteRes = await fetch(`${OCR_SERVICE_URL}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts,
            target_lang: targetCode,
            source_lang: sourceLanguage || "auto"
          })
        });
        const data = await remoteRes.json();
        return res.json({ translations: data.translations || [] });
      } catch (remoteErr) {
        console.error("Remote translate service error, falling back to local:", remoteErr);
      }
    }
    const pythonBridge = spawn("python", ["translate_bridge.py"]);
    let resultData = "";
    let errorData = "";
    pythonBridge.stdout.on("data", (data) => {
      resultData += data.toString();
    });
    pythonBridge.stderr.on("data", (data) => {
      errorData += data.toString();
    });
    pythonBridge.stdin.write(JSON.stringify({
      mode: "translate",
      texts,
      target_lang: targetCode,
      source: sourceLanguage || "auto"
    }) + "\n");
    pythonBridge.stdin.end();
    await new Promise((resolve) => {
      pythonBridge.on("close", resolve);
    });
    if (!resultData.trim()) {
      return res.json({ translations: [] });
    }
    try {
      const translatedTexts = JSON.parse(resultData);
      res.json({ translations: translatedTexts });
    } catch (e) {
      console.error("JSON Parse error on translation output:", resultData);
      res.json({ translations: [] });
    }
  } catch (err) {
    console.error("Translate-only error:", err?.message);
    res.status(500).json({ error: "Translation failed" });
  }
});
app.post("/api/ai/ocr-paddle", async (req, res) => {
  try {
    const { url, lang } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    if (OCR_SERVICE_URL) {
      try {
        const remoteRes = await fetch(`${OCR_SERVICE_URL}/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, lang: lang || "Japanese" })
        });
        const data = await remoteRes.json();
        return res.json(data);
      } catch (remoteErr) {
        console.error("Remote OCR service error, falling back to local:", remoteErr);
      }
    }
    const pythonProcess = spawn("python", ["translate_bridge.py"]);
    let resultData = "";
    let errorData = "";
    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });
    pythonProcess.stdin.write(JSON.stringify({
      mode: "ocr",
      url,
      lang: lang || "Japanese"
    }));
    pythonProcess.stdin.end();
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("OCR Python process exited with code", code, errorData);
        return res.status(500).json({ error: "OCR process failed", details: errorData });
      }
      try {
        const parsed = JSON.parse(resultData);
        res.json(parsed);
      } catch (err) {
        console.error("Failed to parse OCR output:", resultData);
        res.status(500).json({ error: "Failed to parse OCR output" });
      }
    });
  } catch (err) {
    console.error("OCR Endpoint Error:", err);
    res.status(500).json({ error: "Server error during OCR" });
  }
});
var PORT = Number(process.env.PORT) || 3e3;
app.get("/", (req, res) => {
  res.json({ message: "MangaTranslate API. Frontend is deployed separately." });
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OCR Service: ${process.env.OCR_REST_API ? "REST API (" + process.env.OCR_REST_API + ")" : "Local Python bridge"}`);
  const sUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "MISSING";
  const sKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "MISSING";
  console.log(`[Startup] Supabase URL: ${sUrl.substring(0, 15)}...`);
  console.log(`[Startup] Supabase Key: ${sKey ? "PRESENT (starts with " + sKey.substring(0, 5) + ")" : "MISSING"}`);
});
