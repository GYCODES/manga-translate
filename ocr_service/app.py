from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import io
import contextlib
import tempfile
import requests

# Suppress PaddlePaddle logging
os.environ['PP_LOG_LEVEL'] = '4'
os.environ['PADDLE_SDK_LOG_LEVEL'] = '3'
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['FLAGS_use_mkldnn'] = '0'

from paddleocr import PaddleOCR
from deep_translator import GoogleTranslator

app = FastAPI(title="MangaTranslate OCR Service")

# Allow all origins for cross-service communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache OCR instances per language to avoid reloading models
_ocr_cache = {}

def get_ocr(lang: str = 'ch') -> PaddleOCR:
    if lang not in _ocr_cache:
        _ocr_cache[lang] = PaddleOCR(
            use_angle_cls=True,
            lang=lang,
            show_log=False,
            det_db_box_thresh=0.6,
            det_db_unclip_ratio=2.0,
            det_limit_side_len=1500,
            drop_score=0.6
        )
    return _ocr_cache[lang]

# --- Request/Response Models ---

class OcrRequest(BaseModel):
    url: str
    lang: str = "japan"

class OcrBlock(BaseModel):
    text: str
    confidence: float
    x: int
    y: int
    width: int
    height: int

class OcrResponse(BaseModel):
    blocks: List[OcrBlock] = []
    error: Optional[str] = None

class TranslateRequest(BaseModel):
    texts: List[str]
    target_lang: str = "en"
    source_lang: str = "auto"

class TranslateResponse(BaseModel):
    translations: List[str]

# --- OCR Endpoint ---

@app.post("/ocr", response_model=OcrResponse)
async def ocr_endpoint(req: OcrRequest):
    try:
        lang_map = {
            'Japanese': 'japan', 'Chinese': 'ch', 'Korean': 'korean', 'English': 'en',
            'japan': 'japan', 'ch': 'ch', 'korean': 'korean', 'en': 'en',
            'JPN': 'japan', 'CHI': 'ch', 'KOR': 'korean'
        }
        ocr_lang = lang_map.get(req.lang, 'japan')
        paddle_lang = ocr_lang if ocr_lang != 'japan' else 'ch'

        # Download image
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://mangadex.org/' if 'mangadex' in req.url else 'https://mangabuddy.com/'
        }
        r = requests.get(req.url, stream=True, headers=headers, timeout=15)
        if r.status_code != 200:
            return OcrResponse(error=f"Failed to download image: {r.status_code}")

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png', mode='wb')
        for chunk in r.iter_content(1024):
            tmp.write(chunk)
        tmp.close()

        # Run OCR
        ocr = get_ocr(paddle_lang)
        with open(os.devnull, 'w') as devnull:
            with contextlib.redirect_stdout(devnull):
                result = ocr.ocr(tmp.name)

        # Cleanup
        try:
            os.remove(tmp.name)
        except:
            pass

        # Extract blocks
        blocks_raw = []
        if result and result[0]:
            for line in result[0]:
                box = line[0]
                text = line[1][0]
                conf = float(line[1][1])
                if conf < 0.6 or len(text.strip()) == 0:
                    continue
                x_coords = [p[0] for p in box]
                y_coords = [p[1] for p in box]
                min_x, max_x = min(x_coords), max(x_coords)
                min_y, max_y = min(y_coords), max(y_coords)
                blocks_raw.append({
                    "text": text, "confidence": conf,
                    "x": int(min_x), "y": int(min_y),
                    "width": int(max_x - min_x), "height": int(max_y - min_y)
                })

        # Clustering Algorithm v3 (dual merge: X-overlap + Y-overlap)
        clusters = []
        for wb in blocks_raw:
            best_cluster = None
            best_score = 0

            for cluster in clusters:
                if cluster['width'] > 400 or cluster['height'] > 500:
                    continue

                # Edge-to-edge distances
                if wb['y'] > cluster['y'] + cluster['height']:
                    v_edge = wb['y'] - (cluster['y'] + cluster['height'])
                elif cluster['y'] > wb['y'] + wb['height']:
                    v_edge = cluster['y'] - (wb['y'] + wb['height'])
                else:
                    v_edge = 0

                if wb['x'] > cluster['x'] + cluster['width']:
                    h_edge = wb['x'] - (cluster['x'] + cluster['width'])
                elif cluster['x'] > wb['x'] + wb['width']:
                    h_edge = cluster['x'] - (wb['x'] + wb['width'])
                else:
                    h_edge = 0

                ref_h = min(cluster['height'], wb['height'] * 2)
                if ref_h < 8:
                    ref_h = max(cluster['height'], wb['height'], 8)
                ref_w = min(cluster['width'], wb['width'] * 2)
                if ref_w < 8:
                    ref_w = max(cluster['width'], wb['width'], 8)

                # X-overlap (horizontal text)
                x_ol = max(0, min(wb['x'] + wb['width'], cluster['x'] + cluster['width']) - max(wb['x'], cluster['x']))
                x_ratio = x_ol / min(wb['width'], cluster['width']) if min(wb['width'], cluster['width']) > 0 else 0

                # Y-overlap (vertical text columns)
                y_ol = max(0, min(wb['y'] + wb['height'], cluster['y'] + cluster['height']) - max(wb['y'], cluster['y']))
                y_ratio = y_ol / min(wb['height'], cluster['height']) if min(wb['height'], cluster['height']) > 0 else 0

                score = 0

                # Path 1: Horizontal text merge
                if x_ratio > 0.20 and v_edge < ref_h * 1.5 and h_edge < ref_w * 0.5:
                    score = x_ratio + (1.0 - v_edge / max(ref_h * 1.5, 1))

                # Path 2: Vertical column merge
                if y_ratio > 0.25 and h_edge < ref_w * 1.8 and v_edge < ref_h * 0.5:
                    col_score = y_ratio + (1.0 - h_edge / max(ref_w * 1.8, 1))
                    score = max(score, col_score)

                if score > best_score:
                    best_score = score
                    best_cluster = cluster

            if best_cluster is not None and best_score > 0:
                best_cluster['lines'].append(wb)
                new_x = min(best_cluster['x'], wb['x'])
                new_y = min(best_cluster['y'], wb['y'])
                new_max_x = max(best_cluster['x'] + best_cluster['width'], wb['x'] + wb['width'])
                new_max_y = max(best_cluster['y'] + best_cluster['height'], wb['y'] + wb['height'])
                best_cluster['x'] = new_x
                best_cluster['y'] = new_y
                best_cluster['width'] = new_max_x - new_x
                best_cluster['height'] = new_max_y - new_y
            else:
                clusters.append({
                    'x': wb['x'], 'y': wb['y'], 'width': wb['width'], 'height': wb['height'],
                    'lines': [wb]
                })

        # Build final blocks
        blocks = []
        for cluster in clusters:
            is_vertical = cluster['height'] > cluster['width']
            if is_vertical:
                cluster['lines'].sort(key=lambda b: (-b['x'], b['y']))
            else:
                cluster['lines'].sort(key=lambda b: (b['y'], b['x']))
            combined_text = ' '.join([str(l['text']) for l in cluster['lines']])
            avg_conf = sum([l['confidence'] for l in cluster['lines']]) / len(cluster['lines'])
            blocks.append(OcrBlock(
                text=combined_text, confidence=avg_conf,
                x=cluster['x'], y=cluster['y'],
                width=cluster['width'], height=cluster['height']
            ))

        return OcrResponse(blocks=blocks)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return OcrResponse(error=str(e))

# --- Translation Endpoint ---

@app.post("/translate", response_model=TranslateResponse)
async def translate_endpoint(req: TranslateRequest):
    try:
        lang_fix = {'japan': 'ja', 'ch': 'zh-CN', 'zh-TW': 'zh-TW', 'korean': 'ko'}
        source_code = lang_fix.get(req.source_lang, req.source_lang)

        translator = GoogleTranslator(source=source_code, target=req.target_lang)
        translated = []
        for text in req.texts:
            try:
                clean = str(text).strip()
                if not clean:
                    translated.append(text)
                    continue
                res = translator.translate(clean)
                translated.append(res if res else text)
            except Exception:
                translated.append(text)

        return TranslateResponse(translations=translated)

    except Exception as e:
        return TranslateResponse(translations=req.texts)

# --- Health Check ---

@app.get("/")
async def health():
    return {"status": "ok", "service": "MangaTranslate OCR"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
