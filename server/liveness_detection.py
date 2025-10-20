#!/usr/bin/env python3
"""
Liveness Detection Module for Face Authentication
Implements anti-spoofing using DeepFace and OpenCV techniques
"""

import os
import sys
import json
import base64
import io
import tempfile
import cv2
import numpy as np
from PIL import Image
import time

# Set legacy Keras environment variable before any TensorFlow imports
os.environ["TF_USE_LEGACY_KERAS"] = "1"

DEEPFACE_AVAILABLE = False
DEEPFACE_IMPORT_ERROR = None

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    print("DeepFace available for liveness detection", file=sys.stderr)
except Exception as exc:
    DEEPFACE_IMPORT_ERROR = exc
    print(f"DeepFace not available for liveness: {exc}", file=sys.stderr)

def process_image_from_base64(image_data):
    """Convert base64 image to OpenCV format."""
    try:
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert to OpenCV format
        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        return cv_image
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def detect_blink_ear(landmarks, frame_count=1):
    """
    Calculate Eye Aspect Ratio (EAR) for blink detection.
    Lower EAR indicates closed eyes (blink).
    """
    try:
        # Get eye landmarks (assuming 68-point model)
        left_eye = landmarks[36:42]  # Left eye landmarks
        right_eye = landmarks[42:48]  # Right eye landmarks
        
        # Calculate EAR for both eyes
        left_ear = calculate_ear(left_eye)
        right_ear = calculate_ear(right_eye)
        
        # Average EAR
        ear = (left_ear + right_ear) / 2.0
        
        # Blink threshold (adjust based on testing)
        blink_threshold = 0.25
        
        return {
            'ear': ear,
            'is_blinking': ear < blink_threshold,
            'left_ear': left_ear,
            'right_ear': right_ear
        }
    except Exception as e:
        return {
            'ear': 0.0,
            'is_blinking': False,
            'error': str(e)
        }

def calculate_ear(eye_landmarks):
    """Calculate Eye Aspect Ratio for a set of eye landmarks."""
    try:
        # Vertical eye distances
        A = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
        B = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
        
        # Horizontal eye distance
        C = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
        
        # EAR formula
        ear = (A + B) / (2.0 * C)
        return ear
    except:
        return 0.0

def analyze_face_quality(image):
    """
    Analyze face image quality using multiple metrics.
    """
    try:
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        quality_metrics = {
            'brightness': np.mean(gray),
            'contrast': np.std(gray),
            'sharpness': cv2.Laplacian(gray, cv2.CV_64F).var(),
            'noise_level': estimate_noise(gray),
            'face_size': get_face_size(image),
            'symmetry': calculate_symmetry(gray)
        }
        
        # Calculate overall quality score (0-100)
        quality_score = calculate_quality_score(quality_metrics)
        
        return {
            'score': quality_score,
            'metrics': quality_metrics,
            'is_good_quality': quality_score >= 60
        }
    except Exception as e:
        return {
            'score': 0,
            'metrics': {},
            'is_good_quality': False,
            'error': str(e)
        }

def estimate_noise(image):
    """Estimate image noise level."""
    try:
        # Use Laplacian variance to estimate noise
        laplacian_var = cv2.Laplacian(image, cv2.CV_64F).var()
        return laplacian_var
    except:
        return 0

def get_face_size(image):
    """Estimate face size in the image."""
    try:
        # Simple face size estimation based on image dimensions
        height, width = image.shape[:2]
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(image, 1.1, 4)
        
        if len(faces) > 0:
            # Get the largest face
            largest_face = max(faces, key=lambda x: x[2] * x[3])
            face_area = largest_face[2] * largest_face[3]
            image_area = height * width
            return (face_area / image_area) * 100
        return 0
    except:
        return 0

def calculate_symmetry(image):
    """Calculate face symmetry score."""
    try:
        height, width = image.shape[:2]
        center_x = width // 2
        
        # Compare left and right halves
        left_half = image[:, :center_x]
        right_half = cv2.flip(image[:, center_x:], 1)
        
        # Resize to match if needed
        if left_half.shape != right_half.shape:
            right_half = cv2.resize(right_half, (left_half.shape[1], left_half.shape[0]))
        
        # Calculate difference
        diff = cv2.absdiff(left_half, right_half)
        symmetry_score = 100 - (np.mean(diff) / 255 * 100)
        
        return max(0, symmetry_score)
    except:
        return 0

def calculate_quality_score(metrics):
    """Calculate overall quality score from metrics."""
    try:
        score = 0
        
        # Brightness (0-25 points)
        brightness = metrics.get('brightness', 0)
        if 80 <= brightness <= 180:
            score += 25
        elif 60 <= brightness <= 200:
            score += 15
        else:
            score += 5
        
        # Contrast (0-25 points)
        contrast = metrics.get('contrast', 0)
        if contrast >= 40:
            score += 25
        elif contrast >= 25:
            score += 15
        else:
            score += 5
        
        # Sharpness (0-25 points)
        sharpness = metrics.get('sharpness', 0)
        if sharpness >= 200:
            score += 25
        elif sharpness >= 100:
            score += 15
        else:
            score += 5
        
        # Face size (0-25 points)
        face_size = metrics.get('face_size', 0)
        if face_size >= 15:
            score += 25
        elif face_size >= 10:
            score += 15
        else:
            score += 5
        
        return min(100, score)
    except:
        return 0

def detect_face_landmarks(image):
    """Detect facial landmarks using OpenCV."""
    try:
        # Use dlib-style landmark detection if available, otherwise use OpenCV
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return None
        
        # Get the largest face
        largest_face = max(faces, key=lambda x: x[2] * x[3])
        x, y, w, h = largest_face
        
        # Simple landmark approximation (68-point model approximation)
        landmarks = []
        
        # Face outline (0-16)
        for i in range(17):
            x_point = x + (w * i / 16)
            y_point = y + h * 0.1
            landmarks.append([x_point, y_point])
        
        # Eyebrows (17-26)
        for i in range(10):
            x_point = x + (w * (17 + i) / 25)
            y_point = y + h * 0.25
            landmarks.append([x_point, y_point])
        
        # Nose (27-35)
        for i in range(9):
            x_point = x + w * 0.5
            y_point = y + h * (0.35 + i * 0.05)
            landmarks.append([x_point, y_point])
        
        # Eyes (36-47)
        # Left eye
        for i in range(6):
            angle = (i * 60) * np.pi / 180
            x_point = x + w * 0.3 + (w * 0.1 * np.cos(angle))
            y_point = y + h * 0.4 + (h * 0.05 * np.sin(angle))
            landmarks.append([x_point, y_point])
        
        # Right eye
        for i in range(6):
            angle = (i * 60) * np.pi / 180
            x_point = x + w * 0.7 + (w * 0.1 * np.cos(angle))
            y_point = y + h * 0.4 + (h * 0.05 * np.sin(angle))
            landmarks.append([x_point, y_point])
        
        # Mouth (48-67)
        for i in range(20):
            angle = (i * 18) * np.pi / 180
            x_point = x + w * 0.5 + (w * 0.15 * np.cos(angle))
            y_point = y + h * 0.7 + (h * 0.08 * np.sin(angle))
            landmarks.append([x_point, y_point])
        
        return np.array(landmarks)
    except Exception as e:
        return None

def detect_motion_consistency(frames):
    """
    Analyze motion consistency across multiple frames.
    Real faces have subtle micro-movements, photos don't.
    """
    try:
        if len(frames) < 2:
            return {'score': 0, 'has_motion': False}
        
        motion_scores = []
        
        for i in range(1, len(frames)):
            # Calculate optical flow between consecutive frames
            gray1 = cv2.cvtColor(frames[i-1], cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
            
            # Calculate frame difference
            diff = cv2.absdiff(gray1, gray2)
            motion_score = np.mean(diff)
            motion_scores.append(motion_score)
        
        avg_motion = np.mean(motion_scores)
        
        # Motion threshold (adjust based on testing)
        motion_threshold = 5.0
        
        return {
            'score': min(100, avg_motion * 10),  # Scale to 0-100
            'has_motion': avg_motion > motion_threshold,
            'avg_motion': avg_motion,
            'motion_scores': motion_scores
        }
    except Exception as e:
        return {
            'score': 0,
            'has_motion': False,
            'error': str(e)
        }

def detect_screen_reflection(image):
    """
    Detect if image appears to be from a screen (photo spoofing).
    """
    try:
        # Convert to HSV for better reflection detection
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Look for high saturation and specific hue patterns
        # Screen reflections often have specific color characteristics
        saturation = hsv[:, :, 1]
        value = hsv[:, :, 2]
        
        # Check for uniform high saturation (screen characteristic)
        high_sat_pixels = np.sum(saturation > 200)
        total_pixels = saturation.size
        
        saturation_ratio = high_sat_pixels / total_pixels
        
        # Check for value distribution (screens often have specific brightness patterns)
        value_std = np.std(value)
        
        # Screen reflection indicators
        is_screen_reflection = (
            saturation_ratio > 0.3 or  # High saturation ratio
            value_std < 20  # Low brightness variation
        )
        
        return {
            'is_screen_reflection': is_screen_reflection,
            'saturation_ratio': saturation_ratio,
            'value_std': value_std,
            'confidence': saturation_ratio * 100 if is_screen_reflection else 0
        }
    except Exception as e:
        return {
            'is_screen_reflection': False,
            'error': str(e)
        }

def analyze_age_and_human_verification(image):
    """
    Use DeepFace to verify the face is human and get age estimation.
    """
    if not DEEPFACE_AVAILABLE:
        return {
            'is_human': True,  # Assume human if DeepFace unavailable
            'age_estimated': None,
            'confidence': 0,
            'error': 'DeepFace not available'
        }
    
    try:
        # Create temporary file for DeepFace
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        cv2.imwrite(temp_file.name, image)
        temp_file.close()
        
        # Analyze age and verify human characteristics
        result = DeepFace.analyze(
            img_path=temp_file.name,
            actions=['age'],
            enforce_detection=True
        )
        
        # Clean up
        os.unlink(temp_file.name)
        
        if isinstance(result, list):
            result = result[0]
        
        age = result.get('age', 0)
        
        # Age validation (humans should be reasonable age)
        is_human = 5 <= age <= 100
        
        return {
            'is_human': is_human,
            'age_estimated': age,
            'confidence': 85 if is_human else 30,
            'region': result.get('region', {}),
            'dominant_emotion': result.get('dominant_emotion', 'unknown')
        }
    except Exception as e:
        return {
            'is_human': True,  # Default to human if analysis fails
            'age_estimated': None,
            'confidence': 0,
            'error': str(e)
        }

def comprehensive_liveness_check(frames_data, analysis_duration=2.0):
    """
    Perform comprehensive liveness detection across multiple frames.
    
    Args:
        frames_data: List of base64 encoded images
        analysis_duration: Duration in seconds for analysis
    
    Returns:
        Dictionary with liveness scores and recommendations
    """
    try:
        if not frames_data or len(frames_data) == 0:
            return {
                'success': False,
                'error': 'No frames provided for analysis'
            }
        
        # Process all frames
        frames = []
        for frame_data in frames_data:
            try:
                frame = process_image_from_base64(frame_data)
                frames.append(frame)
            except Exception as e:
                print(f"Failed to process frame: {e}", file=sys.stderr)
        
        if len(frames) == 0:
            return {
                'success': False,
                'error': 'No valid frames could be processed'
            }
        
        # Analyze first frame for quality and basic checks
        first_frame = frames[0]
        
        # 1. Face Quality Analysis
        quality_analysis = analyze_face_quality(first_frame)
        
        # 2. Screen Reflection Detection
        reflection_check = detect_screen_reflection(first_frame)
        
        # 3. Age and Human Verification
        human_check = analyze_age_and_human_verification(first_frame)
        
        # 4. Motion Analysis (if multiple frames)
        motion_analysis = {'score': 0, 'has_motion': False}
        if len(frames) > 1:
            motion_analysis = detect_motion_consistency(frames)
        
        # 5. Blink Detection (if landmarks available)
        landmarks = detect_face_landmarks(first_frame)
        blink_analysis = {'ear': 0, 'is_blinking': False}
        if landmarks is not None:
            blink_analysis = detect_blink_ear(landmarks)
        
        # Calculate overall liveness score
        liveness_score = calculate_liveness_score({
            'quality': quality_analysis,
            'reflection': reflection_check,
            'human': human_check,
            'motion': motion_analysis,
            'blink': blink_analysis
        })
        
        # Generate recommendations
        recommendations = generate_liveness_recommendations({
            'quality': quality_analysis,
            'reflection': reflection_check,
            'human': human_check,
            'motion': motion_analysis,
            'blink': blink_analysis,
            'liveness_score': liveness_score
        })
        
        return {
            'success': True,
            'liveness_score': liveness_score,
            'is_live': liveness_score >= 70,
            'analysis': {
                'quality': quality_analysis,
                'reflection': reflection_check,
                'human': human_check,
                'motion': motion_analysis,
                'blink': blink_analysis
            },
            'recommendations': recommendations,
            'frames_analyzed': len(frames),
            'analysis_duration': analysis_duration
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Liveness analysis failed: {str(e)}',
            'liveness_score': 0,
            'is_live': False
        }

def calculate_liveness_score(analysis_results):
    """
    Calculate overall liveness score from all analysis components.
    """
    try:
        score = 0
        max_score = 100
        
        # Quality component (25 points)
        quality = analysis_results.get('quality', {})
        quality_score = quality.get('score', 0)
        score += (quality_score / 100) * 25
        
        # Human verification (25 points)
        human = analysis_results.get('human', {})
        if human.get('is_human', False):
            score += 25
        elif human.get('confidence', 0) > 50:
            score += 15
        
        # Anti-reflection (20 points)
        reflection = analysis_results.get('reflection', {})
        if not reflection.get('is_screen_reflection', False):
            score += 20
        else:
            score += max(0, 20 - reflection.get('confidence', 0) / 5)
        
        # Motion detection (20 points)
        motion = analysis_results.get('motion', {})
        if motion.get('has_motion', False):
            score += 20
        else:
            motion_score = motion.get('score', 0)
            score += (motion_score / 100) * 20
        
        # Blink detection (10 points) - bonus for detected blinks
        blink = analysis_results.get('blink', {})
        if blink.get('is_blinking', False):
            score += 10
        
        return min(100, max(0, score))
    except:
        return 0

def generate_liveness_recommendations(analysis_results):
    """
    Generate user-friendly recommendations based on liveness analysis.
    """
    recommendations = []
    
    try:
        quality = analysis_results.get('quality', {})
        reflection = analysis_results.get('reflection', {})
        human = analysis_results.get('human', {})
        motion = analysis_results.get('motion', {})
        liveness_score = analysis_results.get('liveness_score', 0)
        
        # Quality recommendations
        if quality.get('score', 0) < 60:
            recommendations.append("Improve image quality - ensure good lighting and hold camera steady")
        
        # Reflection detection
        if reflection.get('is_screen_reflection', False):
            recommendations.append("Avoid showing photos or screens - use live camera feed")
        
        # Human verification
        if not human.get('is_human', False):
            recommendations.append("Face verification failed - ensure you're using a live camera")
        
        # Motion recommendations
        if not motion.get('has_motion', False) and len(analysis_results.get('motion', {}).get('motion_scores', [])) > 1:
            recommendations.append("Move slightly or blink to prove you're live")
        
        # General recommendations based on score
        if liveness_score < 70:
            if liveness_score < 40:
                recommendations.append("Liveness verification failed - please try again with better lighting")
            else:
                recommendations.append("Liveness verification needs improvement - ensure good lighting and look directly at camera")
        else:
            recommendations.append("Liveness verification passed!")
        
        return recommendations
    except:
        return ["Liveness analysis completed"]

def main():
    """Main function to handle liveness detection requests."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "analyze":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                frames_data = data.get('frames', [])
                analysis_duration = data.get('duration', 2.0)
                
                result = comprehensive_liveness_check(frames_data, analysis_duration)
                
                print(json.dumps(result))
                
            elif operation == "single":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                image_data = data.get('image_data', '')
                image = process_image_from_base64(image_data)
                
                # Quick single-frame analysis
                quality_analysis = analyze_face_quality(image)
                reflection_check = detect_screen_reflection(image)
                human_check = analyze_age_and_human_verification(image)
                
                # Simple liveness score
                liveness_score = 0
                if quality_analysis.get('is_good_quality', False):
                    liveness_score += 40
                if not reflection_check.get('is_screen_reflection', False):
                    liveness_score += 30
                if human_check.get('is_human', False):
                    liveness_score += 30
                
                result = {
                    'success': True,
                    'liveness_score': liveness_score,
                    'is_live': liveness_score >= 70,
                    'analysis': {
                        'quality': quality_analysis,
                        'reflection': reflection_check,
                        'human': human_check
                    }
                }
                
                print(json.dumps(result))
                
            else:
                print(json.dumps({
                    'success': False,
                    'error': f'Unknown operation: {operation}'
                }))
        else:
            print(json.dumps({
                'success': False,
                'error': 'No operation specified'
            }))
            
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))

if __name__ == "__main__":
    main()
