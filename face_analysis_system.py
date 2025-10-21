#!/usr/bin/env python3
"""
Comprehensive Face Recognition and Vectorization System
=======================================================

This system provides:
1. Face Detection - Detects if there is a face in the image
2. Liveness Detection - Prevents spoofing attacks (photos of photos, screens, etc.)
3. Face Vectorization - Creates unique embeddings for each face
4. Comparison Matrix - Calculates distances between all face embeddings
5. Analysis Reports - Generates comprehensive analysis reports

Author: AI Assistant
Date: 2024
"""

import os
import sys
import json
import base64
import io
import tempfile
import numpy as np
import cv2
from PIL import Image
import pandas as pd
from typing import List, Dict, Tuple, Optional
import time
from pathlib import Path

# Set up environment for DeepFace
os.environ["TF_USE_LEGACY_KERAS"] = "1"

# Import our existing modules
try:
    from face_recognition_service import generate_face_encoding, calculate_face_distance
    from actual_deepface import verify_faces_with_actual_deepface, analyze_face_quality
    from liveness_detection import comprehensive_liveness_check, analyze_face_quality as liveness_quality
    print("✓ All face recognition modules loaded successfully")
except ImportError as e:
    print(f"Warning: Could not import some modules: {e}")
    print("Some features may not be available")

class FaceAnalysisSystem:
    """
    Comprehensive Face Analysis System that handles detection, liveness, vectorization, and comparison.
    """
    
    def __init__(self):
        self.face_encodings = {}
        self.face_metadata = {}
        self.comparison_matrix = None
        self.analysis_results = {}
        
    def detect_face(self, image_data: str) -> Dict:
        """
        Detect if there is a face in the image.
        
        Args:
            image_data: Base64 encoded image data
            
        Returns:
            Dictionary with face detection results
        """
        try:
            # Convert base64 to image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            # Convert to OpenCV format
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            
            # Load face cascade
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            
            # Detect faces with multiple parameters for better detection
            faces = face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=5, 
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            if len(faces) == 0:
                # Try with more sensitive parameters
                faces = face_cascade.detectMultiScale(
                    gray, 
                    scaleFactor=1.05, 
                    minNeighbors=3, 
                    minSize=(20, 20)
                )
            
            face_detected = len(faces) > 0
            
            result = {
                'face_detected': face_detected,
                'num_faces': len(faces),
                'face_locations': faces.tolist() if face_detected else [],
                'image_dimensions': cv_image.shape[:2],
                'detection_confidence': 'high' if len(faces) > 0 else 'none'
            }
            
            if face_detected:
                # Get the largest face
                largest_face = max(faces, key=lambda f: f[2] * f[3])
                x, y, w, h = largest_face
                
                result.update({
                    'largest_face': {
                        'x': int(x), 'y': int(y), 
                        'width': int(w), 'height': int(h),
                        'area': int(w * h)
                    },
                    'face_quality': self._assess_face_quality(cv_image, largest_face)
                })
            
            return result
            
        except Exception as e:
            return {
                'face_detected': False,
                'error': f"Face detection failed: {str(e)}",
                'num_faces': 0
            }
    
    def _assess_face_quality(self, image, face_rect):
        """Assess the quality of the detected face."""
        try:
            x, y, w, h = face_rect
            face_roi = image[y:y+h, x:x+w]
            
            # Convert to grayscale for analysis
            gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            
            # Calculate quality metrics
            brightness = np.mean(gray_face)
            contrast = np.std(gray_face)
            sharpness = cv2.Laplacian(gray_face, cv2.CV_64F).var()
            
            # Determine quality level
            if sharpness > 200 and 80 <= brightness <= 180 and contrast > 40:
                quality = 'excellent'
            elif sharpness > 100 and 60 <= brightness <= 200 and contrast > 25:
                quality = 'good'
            elif sharpness > 50 and contrast > 15:
                quality = 'fair'
            else:
                quality = 'poor'
            
            return {
                'quality_level': quality,
                'brightness': float(brightness),
                'contrast': float(contrast),
                'sharpness': float(sharpness),
                'face_size': f"{w}x{h}",
                'aspect_ratio': float(w/h)
            }
            
        except Exception as e:
            return {
                'quality_level': 'unknown',
                'error': str(e)
            }
    
    def detect_liveness(self, image_data: str, frames: List[str] = None) -> Dict:
        """
        Detect if the image is from a live person or a spoofed source.
        
        Args:
            image_data: Base64 encoded image data
            frames: Optional list of additional frames for motion analysis
            
        Returns:
            Dictionary with liveness detection results
        """
        try:
            # Use our existing liveness detection module
            if frames:
                result = comprehensive_liveness_check([image_data] + frames)
            else:
                result = comprehensive_liveness_check([image_data])
            
            if not result.get('success', False):
                # Fallback to basic analysis
                return self._basic_liveness_analysis(image_data)
            
            return {
                'is_live': result.get('is_live', False),
                'liveness_score': result.get('liveness_score', 0),
                'analysis': result.get('analysis', {}),
                'recommendations': result.get('recommendations', []),
                'confidence': 'high' if result.get('liveness_score', 0) >= 70 else 'medium' if result.get('liveness_score', 0) >= 40 else 'low'
            }
            
        except Exception as e:
            return self._basic_liveness_analysis(image_data)
    
    def _basic_liveness_analysis(self, image_data: str) -> Dict:
        """Basic liveness analysis when advanced methods fail."""
        try:
            # Convert image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            # Basic quality analysis
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            brightness = np.mean(gray)
            contrast = np.std(gray)
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Simple heuristics for liveness
            is_live = True
            liveness_score = 50  # Base score
            
            # Check for reasonable brightness and contrast
            if 60 <= brightness <= 200 and contrast > 20:
                liveness_score += 20
            else:
                is_live = False
                liveness_score -= 20
            
            # Check for reasonable sharpness
            if sharpness > 50:
                liveness_score += 20
            else:
                is_live = False
                liveness_score -= 20
            
            # Check for color distribution (screens often have specific patterns)
            hsv = cv2.cvtColor(cv_image, cv2.COLOR_BGR2HSV)
            saturation = hsv[:, :, 1]
            high_sat_ratio = np.sum(saturation > 200) / saturation.size
            
            if high_sat_ratio < 0.3:  # Not too saturated (screen-like)
                liveness_score += 10
            else:
                liveness_score -= 10
            
            return {
                'is_live': is_live and liveness_score >= 60,
                'liveness_score': max(0, min(100, liveness_score)),
                'analysis': {
                    'brightness': float(brightness),
                    'contrast': float(contrast),
                    'sharpness': float(sharpness),
                    'saturation_ratio': float(high_sat_ratio)
                },
                'confidence': 'low',
                'method': 'basic_analysis'
            }
            
        except Exception as e:
            return {
                'is_live': False,
                'liveness_score': 0,
                'error': f"Liveness analysis failed: {str(e)}",
                'confidence': 'none'
            }
    
    def vectorize_face(self, image_data: str, person_name: str = None) -> Dict:
        """
        Create a vector embedding for the face in the image.
        
        Args:
            image_data: Base64 encoded image data
            person_name: Optional name for the person
            
        Returns:
            Dictionary with face vectorization results
        """
        try:
            # Generate face encoding using our existing service
            face_encoding = generate_face_encoding(image_data)
            
            # Create unique identifier
            face_id = f"face_{int(time.time() * 1000)}_{hash(image_data) % 10000}"
            
            # Store the encoding
            self.face_encodings[face_id] = face_encoding
            
            # Store metadata
            self.face_metadata[face_id] = {
                'person_name': person_name or f"Person_{face_id}",
                'timestamp': time.time(),
                'encoding_dimension': len(face_encoding),
                'image_data': image_data[:100] + "..." if len(image_data) > 100 else image_data  # Truncated for storage
            }
            
            return {
                'success': True,
                'face_id': face_id,
                'person_name': person_name or f"Person_{face_id}",
                'encoding_dimension': len(face_encoding),
                'encoding_preview': face_encoding[:10] + ["..."] if len(face_encoding) > 10 else face_encoding,
                'vector_magnitude': float(np.linalg.norm(face_encoding))
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Face vectorization failed: {str(e)}"
            }
    
    def compare_faces(self, face_id1: str, face_id2: str) -> Dict:
        """
        Compare two face vectors and calculate their distance.
        
        Args:
            face_id1: ID of first face
            face_id2: ID of second face
            
        Returns:
            Dictionary with comparison results
        """
        try:
            if face_id1 not in self.face_encodings:
                return {'error': f"Face ID {face_id1} not found"}
            
            if face_id2 not in self.face_encodings:
                return {'error': f"Face ID {face_id2} not found"}
            
            encoding1 = self.face_encodings[face_id1]
            encoding2 = self.face_encodings[face_id2]
            
            # Calculate distance
            distance = calculate_face_distance(encoding1, encoding2)
            
            # Determine if faces match (threshold of 0.6)
            is_match = distance <= 0.6
            
            # Get person names
            person1 = self.face_metadata[face_id1]['person_name']
            person2 = self.face_metadata[face_id2]['person_name']
            
            return {
                'success': True,
                'face_id1': face_id1,
                'face_id2': face_id2,
                'person1': person1,
                'person2': person2,
                'distance': float(distance),
                'is_match': is_match,
                'similarity_percentage': max(0, (1 - distance) * 100),
                'match_confidence': 'high' if distance < 0.4 else 'medium' if distance < 0.6 else 'low'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Face comparison failed: {str(e)}"
            }
    
    def generate_comparison_matrix(self) -> Dict:
        """
        Generate a comparison matrix for all stored face vectors.
        
        Returns:
            Dictionary with comparison matrix and analysis
        """
        try:
            face_ids = list(self.face_encodings.keys())
            n_faces = len(face_ids)
            
            if n_faces < 2:
                return {
                    'success': False,
                    'error': 'Need at least 2 faces to generate comparison matrix'
                }
            
            # Create distance matrix
            distance_matrix = np.zeros((n_faces, n_faces))
            similarity_matrix = np.zeros((n_faces, n_faces))
            
            # Calculate all pairwise distances
            for i in range(n_faces):
                for j in range(n_faces):
                    if i == j:
                        distance_matrix[i, j] = 0.0
                        similarity_matrix[i, j] = 100.0
                    else:
                        distance = calculate_face_distance(
                            self.face_encodings[face_ids[i]], 
                            self.face_encodings[face_ids[j]]
                        )
                        distance_matrix[i, j] = distance
                        similarity_matrix[i, j] = max(0, (1 - distance) * 100)
            
            # Create DataFrame for better visualization
            person_names = [self.face_metadata[face_id]['person_name'] for face_id in face_ids]
            
            distance_df = pd.DataFrame(
                distance_matrix, 
                index=person_names, 
                columns=person_names
            )
            
            similarity_df = pd.DataFrame(
                similarity_matrix, 
                index=person_names, 
                columns=person_names
            )
            
            # Find closest and most different pairs
            closest_pairs = []
            most_different_pairs = []
            
            for i in range(n_faces):
                for j in range(i + 1, n_faces):
                    distance = distance_matrix[i, j]
                    pair = {
                        'person1': person_names[i],
                        'person2': person_names[j],
                        'distance': float(distance),
                        'similarity': float(similarity_matrix[i, j])
                    }
                    
                    if distance < 0.6:  # Potential match
                        closest_pairs.append(pair)
                    else:
                        most_different_pairs.append(pair)
            
            # Sort by distance
            closest_pairs.sort(key=lambda x: x['distance'])
            most_different_pairs.sort(key=lambda x: x['distance'], reverse=True)
            
            # Store matrix for later use
            self.comparison_matrix = {
                'distance_matrix': distance_matrix,
                'similarity_matrix': similarity_matrix,
                'face_ids': face_ids,
                'person_names': person_names
            }
            
            return {
                'success': True,
                'num_faces': n_faces,
                'distance_matrix': distance_matrix.tolist(),
                'similarity_matrix': similarity_matrix.tolist(),
                'person_names': person_names,
                'closest_pairs': closest_pairs[:5],  # Top 5 closest
                'most_different_pairs': most_different_pairs[:5],  # Top 5 most different
                'statistics': {
                    'min_distance': float(np.min(distance_matrix[distance_matrix > 0])),
                    'max_distance': float(np.max(distance_matrix)),
                    'mean_distance': float(np.mean(distance_matrix[distance_matrix > 0])),
                    'std_distance': float(np.std(distance_matrix[distance_matrix > 0]))
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Comparison matrix generation failed: {str(e)}"
            }
    
    def analyze_image(self, image_data: str, person_name: str = None) -> Dict:
        """
        Perform comprehensive analysis of a single image.
        
        Args:
            image_data: Base64 encoded image data
            person_name: Optional name for the person
            
        Returns:
            Dictionary with complete analysis results
        """
        try:
            print(f"Analyzing image for {person_name or 'Unknown person'}...")
            
            # 1. Face Detection
            face_detection = self.detect_face(image_data)
            
            if not face_detection['face_detected']:
                return {
                    'success': False,
                    'error': 'No face detected in image',
                    'face_detection': face_detection
                }
            
            # 2. Liveness Detection
            liveness_detection = self.detect_liveness(image_data)
            
            # 3. Face Vectorization
            vectorization = self.vectorize_face(image_data, person_name)
            
            if not vectorization['success']:
                return {
                    'success': False,
                    'error': 'Face vectorization failed',
                    'face_detection': face_detection,
                    'liveness_detection': liveness_detection
                }
            
            # 4. Quality Assessment
            quality_assessment = self._assess_overall_quality(face_detection, liveness_detection, vectorization)
            
            return {
                'success': True,
                'person_name': person_name or vectorization['person_name'],
                'face_id': vectorization['face_id'],
                'face_detection': face_detection,
                'liveness_detection': liveness_detection,
                'vectorization': vectorization,
                'quality_assessment': quality_assessment,
                'analysis_timestamp': time.time()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Image analysis failed: {str(e)}"
            }
    
    def _assess_overall_quality(self, face_detection: Dict, liveness_detection: Dict, vectorization: Dict) -> Dict:
        """Assess overall quality of the analysis."""
        try:
            quality_score = 0
            max_score = 100
            issues = []
            
            # Face detection quality (30 points)
            if face_detection['face_detected']:
                quality_score += 30
                if 'face_quality' in face_detection:
                    face_quality = face_detection['face_quality']['quality_level']
                    if face_quality == 'excellent':
                        quality_score += 10
                    elif face_quality == 'good':
                        quality_score += 5
                    elif face_quality == 'poor':
                        issues.append("Poor face quality detected")
            else:
                issues.append("No face detected")
            
            # Liveness detection quality (30 points)
            if liveness_detection.get('is_live', False):
                quality_score += 30
            else:
                quality_score += max(0, liveness_detection.get('liveness_score', 0) * 0.3)
                issues.append("Liveness verification failed or uncertain")
            
            # Vectorization quality (40 points)
            if vectorization['success']:
                quality_score += 40
                if vectorization['encoding_dimension'] < 100:
                    issues.append("Low-dimensional face encoding")
            else:
                issues.append("Face vectorization failed")
            
            # Determine overall quality
            if quality_score >= 90:
                overall_quality = 'excellent'
            elif quality_score >= 70:
                overall_quality = 'good'
            elif quality_score >= 50:
                overall_quality = 'fair'
            else:
                overall_quality = 'poor'
            
            return {
                'overall_quality': overall_quality,
                'quality_score': min(100, quality_score),
                'max_possible_score': max_score,
                'issues': issues,
                'recommendations': self._generate_quality_recommendations(issues)
            }
            
        except Exception as e:
            return {
                'overall_quality': 'unknown',
                'quality_score': 0,
                'error': str(e),
                'issues': ['Quality assessment failed']
            }
    
    def _generate_quality_recommendations(self, issues: List[str]) -> List[str]:
        """Generate recommendations based on detected issues."""
        recommendations = []
        
        if "No face detected" in issues:
            recommendations.append("Ensure face is clearly visible and well-lit")
        
        if "Poor face quality detected" in issues:
            recommendations.append("Improve lighting and hold camera steady")
        
        if "Liveness verification failed" in issues:
            recommendations.append("Use live camera feed, avoid photos of photos")
        
        if "Face vectorization failed" in issues:
            recommendations.append("Ensure face is clearly visible and try again")
        
        if not recommendations:
            recommendations.append("Image quality is good for face recognition")
        
        return recommendations
    
    def generate_analysis_report(self) -> Dict:
        """
        Generate a comprehensive analysis report for all processed images.
        
        Returns:
            Dictionary with complete analysis report
        """
        try:
            if not self.face_encodings:
                return {
                    'success': False,
                    'error': 'No faces have been processed yet'
                }
            
            # Generate comparison matrix
            matrix_result = self.generate_comparison_matrix()
            
            if not matrix_result['success']:
                return matrix_result
            
            # Create detailed report
            report = {
                'success': True,
                'analysis_summary': {
                    'total_faces_processed': len(self.face_encodings),
                    'unique_persons': len(set(meta['person_name'] for meta in self.face_metadata.values())),
                    'analysis_timestamp': time.time()
                },
                'face_metadata': self.face_metadata,
                'comparison_matrix': matrix_result,
                'recommendations': self._generate_system_recommendations(matrix_result)
            }
            
            return report
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Report generation failed: {str(e)}"
            }
    
    def _generate_system_recommendations(self, matrix_result: Dict) -> List[str]:
        """Generate system-wide recommendations based on analysis."""
        recommendations = []
        
        closest_pairs = matrix_result.get('closest_pairs', [])
        most_different_pairs = matrix_result.get('most_different_pairs', [])
        
        # Check for potential matches
        for pair in closest_pairs:
            if pair['distance'] < 0.6:
                recommendations.append(
                    f"Potential match detected: {pair['person1']} and {pair['person2']} "
                    f"(similarity: {pair['similarity']:.1f}%)"
                )
        
        # Check for very different faces
        if most_different_pairs:
            most_diff = most_different_pairs[0]
            recommendations.append(
                f"Most different faces: {most_diff['person1']} and {most_diff['person2']} "
                f"(similarity: {most_diff['similarity']:.1f}%)"
            )
        
        # General recommendations
        recommendations.extend([
            "All face vectors have been successfully generated and stored",
            "Use the comparison matrix to identify similar and different faces",
            "Face embeddings can be used for secure authentication without storing actual images"
        ])
        
        return recommendations

def main():
    """Main function for command-line usage."""
    try:
        if len(sys.argv) < 2:
            print("Usage: python face_analysis_system.py <command> [options]")
            print("Commands:")
            print("  analyze <image_file> [person_name] - Analyze a single image")
            print("  batch_analyze <directory> - Analyze all images in a directory")
            print("  compare <face_id1> <face_id2> - Compare two faces")
            print("  matrix - Generate comparison matrix")
            print("  report - Generate analysis report")
            return
        
        command = sys.argv[1]
        system = FaceAnalysisSystem()
        
        if command == "analyze":
            if len(sys.argv) < 3:
                print("Error: Please provide image file path")
                return
            
            image_path = sys.argv[2]
            person_name = sys.argv[3] if len(sys.argv) > 3 else None
            
            # Read and encode image
            with open(image_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            result = system.analyze_image(image_data, person_name)
            print(json.dumps(result, indent=2))
        
        elif command == "matrix":
            result = system.generate_comparison_matrix()
            print(json.dumps(result, indent=2))
        
        elif command == "report":
            result = system.generate_analysis_report()
            print(json.dumps(result, indent=2))
        
        else:
            print(f"Unknown command: {command}")
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))

if __name__ == "__main__":
    main()