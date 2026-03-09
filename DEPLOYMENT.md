# MangaTranslate Deployment Guide

## Architecture Overview

```
┌──────────────────────┐    ┌──────────────────────┐
│   Vercel             │    │  HuggingFace Spaces   │
│                      │    │  (Docker)             │
│  React Frontend      │    │                       │
│  + Express Serverless│───▶│  POST /ocr            │
│  (API Routes)        │    │  POST /translate      │
│                      │    │  GET  /  (health)     │
└──────────────────────┘    └──────────────────────┘
```

**Frontend + Express API** → deployed on **Vercel** (static + serverless functions)  
**PaddleOCR + Google Translate** → deployed on **HuggingFace Spaces** (Docker container, free CPU tier)

---

## Step 1: Deploy OCR Service to HuggingFace Spaces

### 1.1 Create a HuggingFace Account
- Sign up at [huggingface.co](https://huggingface.co)

### 1.2 Create a New Space
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. **Space name**: `manga-ocr-service`
3. **SDK**: Select **Docker**
4. **Hardware**: CPU basic (free)
5. Click **Create Space**

### 1.3 Push the OCR Service
```bash
# Clone your new space
git clone https://huggingface.co/spaces/YOUR_USERNAME/manga-ocr-service
cd manga-ocr-service

# Copy the OCR service files
cp /path/to/manga-translate/ocr_service/app.py .
cp /path/to/manga-translate/ocr_service/Dockerfile .
cp /path/to/manga-translate/ocr_service/requirements.txt .

# Push to HuggingFace
git add .
git commit -m "Deploy PaddleOCR service"
git push
```

### 1.4 Wait for Build
- The Docker image will build automatically (~5-10 min first time)
- Once running, your OCR service will be available at:
  ```
  https://YOUR_USERNAME-manga-ocr-service.hf.space
  ```

### 1.5 Test the Service
```bash
# Health check
curl https://YOUR_USERNAME-manga-ocr-service.hf.space/

# Test OCR
curl -X POST https://YOUR_USERNAME-manga-ocr-service.hf.space/ocr \
  -H "Content-Type: application/json" \
  -d '{"url": "https://uploads.mangadex.org/...", "lang": "japan"}'
```

---

## Step 2: Deploy Frontend + Backend to Vercel

### 2.1 Install Vercel CLI
```bash
npm i -g vercel
```

### 2.2 Create `vercel.json` in project root
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" }
  ]
}
```

### 2.3 Create Vercel API Entry Point
Create `api/index.ts`:
```typescript
import app from '../server';
export default app;
```

Then modify `server.ts` — change the bottom:
```typescript
// Replace the app.listen block with:
export default app;

// Only listen when running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

### 2.4 Set Environment Variables in Vercel
In [vercel.com](https://vercel.com) → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `OCR_SERVICE_URL` | `https://YOUR_USERNAME-manga-ocr-service.hf.space` |
| `GEMINI_API_KEY` | Your Gemini API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

### 2.5 Deploy
```bash
vercel --prod
```

---

## Step 3: Verify

1. Open your Vercel deployment URL
2. Navigate to a manga and open a chapter
3. The OCR should work via the remote HuggingFace service
4. Translations should flow through the remote `/translate` endpoint

---

## Important Notes

- **HuggingFace free tier CPU** is slower than local GPU. First OCR request may take 15-30s as the model loads from cold start. Subsequent requests are faster (~5-8s).
- **HuggingFace Spaces sleep** after 48h of inactivity on free tier. First request after sleep takes ~2-3min to rebuild.
- **Vercel serverless timeout** is 10s on free tier. If OCR takes longer, you'll get a 504. Consider upgrading to Vercel Pro (25s timeout) or using Vercel's streaming response.
- **Alternative**: Deploy backend on [Railway](https://railway.app) or [Render](https://render.com) as a persistent server to avoid serverless timeout issues.

---

## Local Development

For local dev, leave `OCR_SERVICE_URL` unset in `.env` — the server will use the local Python bridge automatically:

```bash
# Start backend (uses local PaddleOCR via Python)
npx tsx server.ts

# Start frontend
npm run dev
```
