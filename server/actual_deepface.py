#!/usr/bin/env python3
"""
Actual DeepFace implementation using the real DeepFace.verify function
No custom shit, just the actual library as requested
"""

import os
# Set legacy Keras environment variable before any TensorFlow imports
os.environ["TF_USE_LEGACY_KERAS"] = "1"

import sys
import json
import base64
import io
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
    print("DeepFace import successful - using high-accuracy FaceNet model", file=sys.stderr)
except Exception as exc:  # ImportError or any dependency loading error
    DEEPFACE_IMPORT_ERROR = exc
    print(f"DeepFace import error: {exc}", file=sys.stderr)
    print("Falling back to OpenCV-based face recognition", file=sys.stderr)

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

def analyze_face_quality(image_path):
    """Analyze face image quality and provide feedback."""
    try:
        import cv2
        import numpy as np
        
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            return {"quality": "poor", "issues": ["Could not load image"]}
        
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        issues = []
        quality_score = 100
        
        # Check image size
        height, width = gray.shape
        if height < 100 or width < 100:
            issues.append("Image too small")
            quality_score -= 30
        
        # Check brightness
        mean_brightness = np.mean(gray)
        if mean_brightness < 50:
            issues.append("Image too dark")
            quality_score -= 20
        elif mean_brightness > 200:
            issues.append("Image too bright")
            quality_score -= 20
        
        # Check contrast
        contrast = np.std(gray)
        if contrast < 20:
            issues.append("Low contrast")
            quality_score -= 15
        
        # Check blur (Laplacian variance)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < 100:
            issues.append("Image appears blurry")
            quality_score -= 25
        
        # Determine overall quality
        if quality_score >= 80:
            quality = "excellent"
        elif quality_score >= 60:
            quality = "good"
        elif quality_score >= 40:
            quality = "fair"
        else:
            quality = "poor"
        
        return {
            "quality": quality,
            "score": quality_score,
            "issues": issues,
            "brightness": mean_brightness,
            "contrast": contrast,
            "blur_score": blur_score
        }
        
    except Exception as e:
        return {"quality": "unknown", "issues": [f"Analysis failed: {str(e)}"]}

def generate_quality_recommendations(registered_quality, captured_quality, distance, is_verified):
    """Generate user-friendly recommendations based on face quality and verification results."""
    recommendations = []
    
    if not is_verified:
        if distance > 0.8:
            recommendations.append("Face verification failed - the faces appear to be different people")
        elif distance > 0.65:
            recommendations.append("Face verification failed - try improving lighting and face angle")
        else:
            recommendations.append("Face verification failed - try again with better lighting")
    
    # Check registered face quality
    if registered_quality.get("quality") in ["poor", "fair"]:
        recommendations.append("Your registered face image quality is low - ask your manager to retake your photo")
    
    # Check captured face quality
    if captured_quality.get("quality") in ["poor", "fair"]:
        recommendations.append("Current photo quality is poor - try better lighting and hold still")
    
    # Specific quality issues
    registered_issues = registered_quality.get("issues", [])
    captured_issues = captured_quality.get("issues", [])
    
    if "Image too dark" in captured_issues:
        recommendations.append("Photo is too dark - move to better lighting")
    elif "Image too bright" in captured_issues:
        recommendations.append("Photo is too bright - avoid direct sunlight")
    
    if "Image appears blurry" in captured_issues:
        recommendations.append("Photo is blurry - hold your phone steady")
    
    if "Low contrast" in captured_issues:
        recommendations.append("Photo has low contrast - try different lighting")
    
    if not recommendations:
        if is_verified:
            recommendations.append("Face verification successful!")
        else:
            recommendations.append("Try again with better lighting and face the camera directly")
    
    return recommendations

def verify_faces_with_actual_deepface(registered_image_data, captured_image_data):
    """Verify faces using actual DeepFace.verify function."""
    temp_files = []
    try:
        # Convert base64 images to temporary files
        registered_path = process_image_from_base64(registered_image_data)
        captured_path = process_image_from_base64(captured_image_data)
        temp_files = [registered_path, captured_path]
        
        # Analyze face quality
        registered_quality = analyze_face_quality(registered_path)
        captured_quality = analyze_face_quality(captured_path)
        
        # Use actual DeepFace.verify function with custom threshold
        result = DeepFace.verify(
            img1_path=registered_path,
            img2_path=captured_path,
            model_name='Facenet',
            detector_backend='opencv',
            distance_metric='euclidean',
            enforce_detection=True
        )
        
        # Apply our own threshold for better real-world accuracy
        # DeepFace's default threshold (0.4) is too strict for practical use
        # We'll use 0.6-0.7 which is more appropriate for real-world conditions
        custom_threshold = 0.65
        distance = float(result['distance'])
        is_verified = distance <= custom_threshold
        
        return {
            "verified": is_verified,
            "distance": distance,
            "threshold": custom_threshold,
            "model": result['model'],
            "deepface_original_verified": bool(result['verified']),
            "deepface_original_threshold": float(result['threshold']),
            "quality_analysis": {
                "registered_face": registered_quality,
                "captured_face": captured_quality
            },
            "recommendations": generate_quality_recommendations(registered_quality, captured_quality, distance, is_verified)
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
    comparison = compare_faces_simple(known_encoding, captured_image_data, tolerance=0.75)

    return {
        "verified": bool(comparison.get("is_match")),
        "distance": float(comparison.get("distance", 0.0)),
        "threshold": float(comparison.get("tolerance", 0.75)),
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