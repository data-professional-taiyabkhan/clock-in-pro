#!/usr/bin/env python3
import sys
import json
import base64
import io
import os
from typing import Any, Dict

try:
    from PIL import Image
    import numpy as np
    import insightface  # type: ignore
    from insightface.app import FaceAnalysis  # type: ignore
except Exception as exc:
    print(json.dumps({
        "success": False,
        "error": f"Failed to import dependencies: {exc}"
    }))
    sys.exit(1)

_app = None

def get_app() -> FaceAnalysis:
    global _app
    if _app is not None:
        return _app
    # Initialize InsightFace with a robust model; fallback to CPU provider
    providers = os.environ.get('INSIGHTFACE_PROVIDERS')
    provider_list = [p.strip() for p in providers.split(',')] if providers else [
        'CPUExecutionProvider'
    ]
    app = FaceAnalysis(name='buffalo_l', providers=provider_list)
    app.prepare(ctx_id=0, det_size=(640, 640))
    _app = app
    return _app

def b64_to_ndarray(image_b64: str) -> np.ndarray:
    if image_b64.startswith('data:image'):
        image_b64 = image_b64.split(',')[1]
    img_bytes = base64.b64decode(image_b64)
    pil = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return np.array(pil)


def embed(image_b64: str) -> Dict[str, Any]:
    app = get_app()
    img = b64_to_ndarray(image_b64)
    faces = app.get(img)
    if not faces:
        return {"success": False, "error": "No face detected"}
    # Pick the largest face
    faces.sort(key=lambda f: f.bbox[2] * f.bbox[3], reverse=True)
    face = faces[0]
    # 'embedding' is L2-normalized 512-D
    emb = face.normed_embedding if hasattr(face, 'normed_embedding') else face.embedding
    if emb is None:
        return {"success": False, "error": "Failed to compute embedding"}
    return {"success": True, "embedding": emb.tolist()}


def main():
    try:
        data = sys.stdin.read()
        payload = json.loads(data) if data else {}
        cmd = payload.get('cmd', 'embed')
        if cmd == 'embed':
            image_data = payload.get('image') or payload.get('image_data') or payload.get('imageData')
            if not image_data:
                print(json.dumps({"success": False, "error": "Missing image data"}))
                return
            result = embed(image_data)
            print(json.dumps(result))
            return
        else:
            print(json.dumps({"success": False, "error": f"Unknown cmd: {cmd}"}))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))

if __name__ == '__main__':
    main()
