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
    # Force explicit source language if auto-detect fails on manga mixed-character strings
    translator = GoogleTranslator(source=source_lang, target=target_lang)
    for index, orig in enumerate(texts):
        try:
            # Clean up excessively weird elements that reject translation
            clean = str(orig).strip()
            if not clean:
                translated_texts.append(orig)
                continue
                
            res = translator.translate(clean)
            translated_texts.append(res if res else orig)
        except Exception as e:
            # If Google Translate rejects a single string, fallback only that string
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
                    r = requests.get(image_source, stream=True)
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

                # Mathematical Bounding-Box Clustering Algorithm
                # Groups adjacent vertical/horizontal lines into single cohesive speech bubbles
                clusters = []
                for wb in blocks_raw:
                    merged = False
                    for cluster in clusters:
                        # Calculate geometric distance (x, y) between text boxes against the cluster
                        verticalGap = abs(wb['y'] - cluster['y'])
                        horizontalGap = wb['x'] - (cluster['x'] + cluster['width'])
                        
                        # Dynamic threshold based on cluster height
                        lineHeight = cluster['height']
                        
                        # Intelligent Merge Criteria (Close vertically AND horizontally within same bubble)
                        if verticalGap < (lineHeight * 2.0) and horizontalGap > -(lineHeight * 1.5) and horizontalGap < (lineHeight * 4.0):
                            cluster['lines'].append(wb)
                            
                            # Expand bounding box to encompass the new line
                            new_x = min(cluster['x'], wb['x'])
                            new_y = min(cluster['y'], wb['y'])
                            new_max_x = max(cluster['x'] + cluster['width'], wb['x'] + wb['width'])
                            new_max_y = max(cluster['y'] + cluster['height'], wb['y'] + wb['height'])
                            
                            cluster['x'] = new_x
                            cluster['y'] = new_y
                            cluster['width'] = new_max_x - new_x
                            cluster['height'] = new_max_y - new_y
                            
                            merged = True
                            break
                            
                    if not merged:
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
