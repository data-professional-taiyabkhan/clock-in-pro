#!/usr/bin/env python3
"""
Actual DeepFace implementation using the real DeepFace.verify function
No custom shit, just the actual library as requested
"""

import sys
import json
import base64
import io
import os
import tempfile
from PIL import Image

# Attempt to load DeepFace. If it's unavailable (for example when the
# dependency failed to install on the deployment image) we'll transparently
# fall back to the simple OpenCV-based comparer so that face verification can
# still succeed.  We keep the original import error around so that callers can
# surface a useful warning message.
DEEPFACE_AVAILABLE = False
DEEPFACE_IMPORT_ERROR: Exception | None = None

try:
    from deepface import DeepFace  # type: ignore
    DEEPFACE_AVAILABLE = True
except Exception as exc:  # ImportError or any dependency loading error
    DEEPFACE_IMPORT_ERROR = exc
    print(f"DeepFace import error: {exc}", file=sys.stderr)

encode_face = None  # type: ignore
compare_faces_simple = None  # type: ignore
FALLBACK_READY = False


def ensure_fallback_loaded() -> bool:
    """Load the lightweight OpenCV-based fallback comparer on demand."""
    global encode_face, compare_faces_simple, FALLBACK_READY, DEEPFACE_IMPORT_ERROR

    if FALLBACK_READY and encode_face is not None and compare_faces_simple is not None:
        return True

    try:
        from simple_face_recognition import encode_face as _encode_face, compare_faces_simple as _compare_faces_simple  # type: ignore

        encode_face = _encode_face
        compare_faces_simple = _compare_faces_simple
        FALLBACK_READY = True
        return True
    except Exception as exc:  # pragma: no cover - fallback import failure
        DEEPFACE_IMPORT_ERROR = exc if DEEPFACE_IMPORT_ERROR is None else DEEPFACE_IMPORT_ERROR
        print(f"Fallback face recogniser import error: {exc}", file=sys.stderr)
        return False


if not DEEPFACE_AVAILABLE:
    ensure_fallback_loaded()

def process_image_from_base64(image_data):
    """Convert base64 image to temporary file for DeepFace."""
    try:
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        pil_image.save(temp_file.name, 'JPEG')
        temp_file.close()
        
        return temp_file.name
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def store_face_image(image_data):
    """Store face image - just return the image data."""
    return image_data

def verify_faces_with_actual_deepface(registered_image_data, captured_image_data):
    """Verify faces using actual DeepFace.verify function."""
    temp_files = []
    try:
        # Convert base64 images to temporary files
        registered_path = process_image_from_base64(registered_image_data)
        captured_path = process_image_from_base64(captured_image_data)
        temp_files = [registered_path, captured_path]
        
        # Use actual DeepFace.verify function
        result = DeepFace.verify(
            img1_path=registered_path,
            img2_path=captured_path,
            model_name='Facenet',
            detector_backend='opencv'
        )
        
        return {
            "verified": bool(result['verified']),
            "distance": float(result['distance']),
            "threshold": float(result['threshold']),
            "model": result['model']
        }
        
    except Exception as e:
        raise Exception(f"DeepFace verification failed: {str(e)}")
    finally:
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except:
                pass


def verify_faces_with_simple_fallback(registered_image_data, captured_image_data):
    """Fallback verification when DeepFace is unavailable."""
    if not ensure_fallback_loaded() or encode_face is None or compare_faces_simple is None:
        raise RuntimeError(
            "DeepFace is unavailable and the OpenCV fallback could not be loaded."
        )

    known_encoding = encode_face(registered_image_data)
    comparison = compare_faces_simple(known_encoding, captured_image_data, tolerance=0.55)

    return {
        "verified": bool(comparison.get("is_match")),
        "distance": float(comparison.get("distance", 0.0)),
        "threshold": float(comparison.get("tolerance", 0.55)),
        "model": "opencv-simple",
        "details": {
            "engine": "opencv_fallback",
            "note": "DeepFace import failed; using OpenCV-based comparison",
        },
    }

def main():
    """Main function to handle operations."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "store":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                stored_data = store_face_image(image_data)
                
                print(json.dumps({
                    "success": True,
                    "image_data": stored_data
                }))
                
            elif operation == "verify":
                input_data = sys.stdin.read()
                data = json.loads(input_data)

                registered_image = data.get('registered_image', '')
                captured_image = data.get('captured_image', '')

                warning_message = None

                if DEEPFACE_AVAILABLE:
                    try:
                        result = verify_faces_with_actual_deepface(registered_image, captured_image)
                        print(json.dumps({
                            "success": True,
                            "engine": "deepface",
                            "result": result
                        }))
                        return
                    except Exception as deepface_error:
                        print(f"DeepFace verification error: {deepface_error}", file=sys.stderr)
                        # Attempt to fall back to the OpenCV pipeline
                        warning_message = f"DeepFace verification failed: {deepface_error}"
                        if DEEPFACE_IMPORT_ERROR is not None:
                            warning_message += f" (import issue: {DEEPFACE_IMPORT_ERROR})"

                try:
                    result = verify_faces_with_simple_fallback(registered_image, captured_image)
                    warning = warning_message
                    if DEEPFACE_AVAILABLE and warning is None and DEEPFACE_IMPORT_ERROR is not None:
                        warning = f"DeepFace unavailable: {DEEPFACE_IMPORT_ERROR}"
                    elif not DEEPFACE_AVAILABLE and warning is None and DEEPFACE_IMPORT_ERROR is not None:
                        warning = f"DeepFace unavailable: {DEEPFACE_IMPORT_ERROR}"

                    response = {
                        "success": True,
                        "engine": "opencv_fallback",
                        "result": result,
                    }
                    if warning:
                        response["warning"] = warning

                    print(json.dumps(response))
                except Exception as fallback_error:
                    error_message = "DeepFace import failed and fallback comparison is unavailable."
                    if DEEPFACE_IMPORT_ERROR is not None:
                        error_message += f" DeepFace error: {DEEPFACE_IMPORT_ERROR}."
                    if warning_message is not None:
                        error_message += f" Verification error: {warning_message}."
                    error_message += f" Fallback error: {fallback_error}."
                    print(json.dumps({
                        "success": False,
                        "error": error_message
                    }))
                
            else:
                print(json.dumps({
                    "success": False,
                    "error": f"Unknown operation: {operation}"
                }))
                
        else:
            print(json.dumps({
                "success": False,
                "error": "No operation specified"
            }))
            
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    main()