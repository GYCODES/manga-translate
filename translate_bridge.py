import sys
import json
import io
import os
import requests
import contextlib

# Force UTF-8 for stdin and stderr to prevent encoding issues on Windows
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

# Save original stdout for our final JSON output
real_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Redirect sys.stdout to sys.stderr so any library print statements don't corrupt JSON
sys.stdout = sys.stderr

# Suppress PaddlePaddle/PaddleOCR logging before importing
os.environ['PP_LOG_LEVEL'] = '4'
os.environ['PADDLE_SDK_LOG_LEVEL'] = '3'
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
os.environ['ANY_LOG_LEVEL'] = '3'
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['FLAGS_use_mkldnn'] = '0'

# Try to import paddleocr
try:
    from paddleocr import PaddleOCR
except ImportError:
    PaddleOCR = None

try:
    from deep_translator import GoogleTranslator
except ImportError:
    GoogleTranslator = None

def translate_batch(texts, target_lang, source_lang='auto'):
    if not GoogleTranslator:
        sys.stderr.write("Translation Error: GoogleTranslator not installed\n")
        return texts
    
    translated_texts = []
    translator = GoogleTranslator(source=source_lang, target=target_lang)
    for orig in texts:
        try:
            clean = str(orig).strip()
            if not clean:
                translated_texts.append(orig)
                continue
                
            res = translator.translate(clean)
            translated_texts.append(res if res else orig)
        except Exception as e:
            sys.stderr.write(f"String Translation Error '{str(orig)[:10]}': {str(e)}\n")
            translated_texts.append(orig)
            
    return translated_texts

def run_ocr(image_source, lang='japan'):
    if not PaddleOCR:
        return {"error": "PaddleOCR not installed"}
    
    # We use a dummy file to redirect stdout from PaddleOCR initialization
    with open(os.devnull, 'w') as devnull:
        with contextlib.redirect_stdout(devnull):
            try:
                # Initialize PaddleOCR 2.x Stable with Aggressive Manga Tuning
                ocr_lang = lang if lang != 'japan' else 'ch'
                ocr = PaddleOCR(
                    use_angle_cls=True, 
                    lang=ocr_lang, 
                    show_log=False,
                    det_db_box_thresh=0.6,    # Filter blurry noise boxes
                    det_db_unclip_ratio=2.0,  # Expand bounding boxes to aggressively merge adjacent characters
                    det_limit_side_len=1500,  # Force high-res scaling for tiny manga text
                    drop_score=0.6            # Ignore extreme low-confidence results
                )
                
                # If image_source is a URL, download it first
                temp_file = None
                if image_source.startswith('http'):
                    import tempfile
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://mangadex.org/' if 'mangadex' in image_source else 'https://mangabuddy.com/'
                    }
                    r = requests.get(image_source, stream=True, headers=headers, timeout=10)
                    if r.status_code == 200:
                        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png', mode='wb')
                        for chunk in r.iter_content(1024):
                            tmp.write(chunk)
                        tmp.close()
                        image_source = tmp.name
                        temp_file = tmp.name
                    else:
                        return {"error": f"Failed to download image: {r.status_code}"}
                elif image_source.startswith('data:image'):
                    import tempfile
                    import base64
                    import re
                    # Robust extraction of the base64 part
                    b64_data = re.sub('^data:image/.+;base64,', '', image_source)
                    decoded = base64.b64decode(b64_data)
                    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png', mode='wb')
                    tmp.write(decoded)
                    tmp.close()
                    image_source = tmp.name
                    temp_file = tmp.name

                # Use ocr() method for standard PaddleOCR 2.7.x
                result = ocr.ocr(image_source)
                
                # Cleanup temp file if created
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except:
                        pass
                
                # Extract initial blocks
                blocks_raw = []
                if result and result[0]:
                    for line in result[0]:
                        box = line[0] 
                        text = line[1][0]
                        conf = float(line[1][1])
                        
                        # Hard filter to silently drop hallucinatory background noise
                        if conf < 0.6 or len(text.strip()) == 0:
                            continue
                        
                        x_coords = [p[0] for p in box]
                        y_coords = [p[1] for p in box]
                        min_x, max_x = min(x_coords), max(x_coords)
                        min_y, max_y = min(y_coords), max(y_coords)
                        
                        blocks_raw.append({
                            "text": text,
                            "confidence": conf,
                            "x": int(min_x),
                            "y": int(min_y),
                            "width": int(max_x - min_x),
                            "height": int(max_y - min_y)
                        })

                # Mathematical Bounding-Box Clustering Algorithm v3
                # Dual merge: horizontal text (X-overlap) AND vertical columns (Y-overlap)
                clusters = []
                for wb in blocks_raw:
                    best_cluster = None
                    best_score = 0
                    
                    for cluster in clusters:
                        # Skip oversized clusters (prevents runaway merges across panels)
                        if cluster['width'] > 400 or cluster['height'] > 500:
                            continue
                        
                        # Edge-to-edge distances (always >= 0 if no overlap)
                        # Vertical edge distance
                        if wb['y'] > cluster['y'] + cluster['height']:
                            v_edge = wb['y'] - (cluster['y'] + cluster['height'])
                        elif cluster['y'] > wb['y'] + wb['height']:
                            v_edge = cluster['y'] - (wb['y'] + wb['height'])
                        else:
                            v_edge = 0  # overlapping vertically
                        
                        # Horizontal edge distance
                        if wb['x'] > cluster['x'] + cluster['width']:
                            h_edge = wb['x'] - (cluster['x'] + cluster['width'])
                        elif cluster['x'] > wb['x'] + wb['width']:
                            h_edge = cluster['x'] - (wb['x'] + wb['width'])
                        else:
                            h_edge = 0  # overlapping horizontally
                        
                        # Reference line height (use smaller box as reference)
                        ref_h = min(cluster['height'], wb['height'] * 2)
                        if ref_h < 8:
                            ref_h = max(cluster['height'], wb['height'], 8)
                        ref_w = min(cluster['width'], wb['width'] * 2)
                        if ref_w < 8:
                            ref_w = max(cluster['width'], wb['width'], 8)
                        
                        # X-overlap ratio (for horizontal text merging — lines stacked vertically)
                        x_ol_start = max(wb['x'], cluster['x'])
                        x_ol_end = min(wb['x'] + wb['width'], cluster['x'] + cluster['width'])
                        x_overlap = max(0, x_ol_end - x_ol_start)
                        x_min_w = min(wb['width'], cluster['width'])
                        x_ratio = x_overlap / x_min_w if x_min_w > 0 else 0
                        
                        # Y-overlap ratio (for vertical text — columns side by side)
                        y_ol_start = max(wb['y'], cluster['y'])
                        y_ol_end = min(wb['y'] + wb['height'], cluster['y'] + cluster['height'])
                        y_overlap = max(0, y_ol_end - y_ol_start)
                        y_min_h = min(wb['height'], cluster['height'])
                        y_ratio = y_overlap / y_min_h if y_min_h > 0 else 0
                        
                        score = 0
                        
                        # Path 1: Horizontal text merge (lines stacked below each other)
                        # Good X-overlap + close vertically
                        if (x_ratio > 0.20 
                            and v_edge < ref_h * 1.5
                            and h_edge < ref_w * 0.5):
                            score = x_ratio + (1.0 - v_edge / max(ref_h * 1.5, 1))
                        
                        # Path 2: Vertical column merge (columns side by side in same bubble)
                        # Good Y-overlap + close horizontally
                        if (y_ratio > 0.25 
                            and h_edge < ref_w * 1.8
                            and v_edge < ref_h * 0.5):
                            col_score = y_ratio + (1.0 - h_edge / max(ref_w * 1.8, 1))
                            score = max(score, col_score)
                        
                        if score > best_score:
                            best_score = score
                            best_cluster = cluster
                    
                    if best_cluster is not None and best_score > 0:
                        best_cluster['lines'].append(wb)
                        
                        # Expand bounding box
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

                # Directional Sorting & Text Concatenation
                blocks = []
                for cluster in clusters:
                    is_vertical = cluster['height'] > cluster['width']
                    if is_vertical:
                        # Vertical Manga reads Right-to-Left, then Top-to-Bottom
                        cluster['lines'].sort(key=lambda b: (-b['x'], b['y']))
                    else:
                        # Horizontal text reads Top-to-Bottom, Left-to-Right
                        cluster['lines'].sort(key=lambda b: (b['y'], b['x']))
                        
                    combined_text = ' '.join([str(l['text']) for l in cluster['lines']])
                    avg_conf = sum([l['confidence'] for l in cluster['lines']]) / len(cluster['lines'])
                    
                    blocks.append({
                        "text": combined_text,
                        "confidence": avg_conf,
                        "x": cluster['x'],
                        "y": cluster['y'],
                        "width": cluster['width'],
                        "height": cluster['height']
                    })
                
                return {"blocks": blocks}
            except Exception as e:
                import traceback
                error_msg = f"{str(e)}\n{traceback.format_exc()}"
                sys.stderr.write(f"OCR Error: {error_msg}\n")
                return {"error": str(e)}

if __name__ == "__main__":
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
            
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            sys.stderr.write(f"Bridge Execution Error: Invalid JSON input: {line}\n")
            real_stdout.write(json.dumps({"error": "Invalid JSON input"}) + '\n')
            real_stdout.flush()
            continue
        
        mode = req.get('mode')
        lang = req.get('lang', 'japan')
        
        if mode == 'ocr':
            # Handle both human-readable labels (old) and raw model IDs (new)
            lang_map = {'Japanese': 'japan', 'Chinese': 'ch', 'Korean': 'korean', 'English': 'en',
                       'japan': 'japan', 'ch': 'ch', 'korean': 'korean', 'en': 'en',
                       'JPN': 'japan', 'CHI': 'ch', 'KOR': 'korean'}
            ocr_lang = lang_map.get(lang.upper() if len(lang)==3 else lang, 'japan')
            res = run_ocr(req.get('url'), lang=ocr_lang)
            
            # Print JSON on a single line to standard out using the preserved real_stdout
            real_stdout.write(json.dumps(res, ensure_ascii=False) + '\n')
            real_stdout.flush()
            
        elif mode == 'translate':
            target_lang = req.get('target', 'en')
            source_lang = req.get('source', 'auto')
            texts = req.get('texts', [])
            
            # Map common internal labels to deep-translator codes
            lang_fix = {'japan': 'ja', 'ch': 'zh-CN', 'zh-TW': 'zh-TW', 'korean': 'ko'}
            source_code = lang_fix.get(source_lang, source_lang)
            
            res = translate_batch(texts, target_lang, source_code)
            
            real_stdout.write(json.dumps(res, ensure_ascii=False) + '\n')
            real_stdout.flush()
        else:
            sys.stderr.write(f"Bridge Execution Error: Unknown mode: {mode}\n")
            real_stdout.write(json.dumps({"error": f"Unknown mode: {mode}"}, ensure_ascii=False) + '\n')
            real_stdout.flush()
