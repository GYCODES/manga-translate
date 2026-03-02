# 🎌 MangaTranslate - The Ultimate Media Reader

MangaTranslate is a high-performance, AI-powered web application designed for seamless consumption of Manga and Anime. It features real-time on-the-fly translation, a robust scraping architecture, and integrated streaming.

## 🚀 Features

### 📖 Manga Reader
- **Unified Search**: Search across MangaDex and other community sources seamlessly.
- **AI Translation Bridge**: Built-in OCR using Tesseract.js and a Python-powered Deep Translation bridge for instant translation of panels.
- **Scraper Fallback**: If official APIs block a title, MangaTranslate automatically engages the `MangaBuddy` scraper to ensure you never miss a chapter.
- **Image Proxy**: Custom proxy headers to bypass CDN blocks and 403 errors automatically.

### 📺 Anime Streaming
- **Hybrid Search Strategy**: Uses Jikan API as a "Romaji Bridge" to resolve English titles to Japanese equivalents for 100% search accuracy.
- **Sanka Engine**: Integrated streaming via the SankaVollereii API with automated provider fallback (Vidhide, Mega, DStream).
- **Quality-Aware**: Automatically selects high-quality mirrors and provides fallback links in case of broken iframes.
- **Anime Mode**: Instant toggle between Manga and Anime modes with dedicated landing experiences for both.

### 🛠️ Advanced Tools
- **Admin Dashboard**: Comprehensive site management tools.
- **History & Sync**: Track your progress across devices with Supabase-backed history and library synchronization.
- **Toast Notifications**: Interactive feedback system for network status and streaming availability.

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript, Vite, Framer Motion (motion/react), Lucide Icons.
- **Backend**: Express.js, Supabase, Node-Fetch.
- **AI/ML**: Tesseract.js (OCR), Google Gemini API (Summaries), Python Translation Bridge.

## 🚦 Getting Started

### 1. Prerequisites
- **Node.js**: v18+
- **Python**: 3.9+ (for translation bridge)

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/GYCODES/manga-translate.git

# Install NPM dependencies
npm install

# Install Python requirements
pip install deep-translator
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
GEMINI_API_KEY=your_gemini_key
```

### 4. Running Locally
```powershell
# Start the backend server
npx tsx server.ts

# In a separate terminal, start the frontend
npm run dev
```

## 📜 License
Built with ❤️ by [GYCODES](https://github.com/GYCODES).
