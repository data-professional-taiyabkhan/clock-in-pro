#!/usr/bin/env python3
"""
Face Recognition System Test Suite
==================================

This script tests all components of the face recognition system to ensure
everything is working correctly before processing your friends' images.

Usage:
    python test_face_system.py
"""

import os
import sys
import json
import base64
import numpy as np
from pathlib import Path
import time

# Import our modules
try:
    from face_analysis_system import FaceAnalysisSystem
    from friends_face_analyzer import FriendsFaceAnalyzer
    print("✓ All modules imported successfully")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)

class FaceSystemTester:
    """
    Comprehensive test suite for the face recognition system.
    """
    
    def __init__(self):
        self.system = FaceAnalysisSystem()
        self.test_results = {}
        
    def create_test_image(self, width=400, height=400, color=(128, 128, 128)) -> str:
        """
        Create a simple test image for testing purposes.
        
        Args:
            width: Image width
            height: Image height
            color: RGB color tuple
            
        Returns:
            Base64 encoded image data
        """
        from PIL import Image
        
        # Create a simple colored rectangle
        img = Image.new('RGB', (width, height), color)
        
        # Add some basic features to make it more realistic
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        
        # Draw a simple face-like pattern
        # Face outline
        face_margin = 50
        draw.ellipse([face_margin, face_margin, width-face_margin, height-face_margin], 
                    outline=(0, 0, 0), width=3)
        
        # Eyes
        eye_y = height // 3
        left_eye_x = width // 3
        right_eye_x = 2 * width // 3
        draw.ellipse([left_eye_x-20, eye_y-10, left_eye_x+20, eye_y+10], 
                    fill=(0, 0, 0))
        draw.ellipse([right_eye_x-20, eye_y-10, right_eye_x+20, eye_y+10], 
                    fill=(0, 0, 0))
        
        # Nose
        nose_x = width // 2
        nose_y = height // 2
        draw.polygon([(nose_x, nose_y-10), (nose_x-10, nose_y+10), (nose_x+10, nose_y+10)], 
                    fill=(200, 200, 200))
        
        # Mouth
        mouth_y = 2 * height // 3
        draw.arc([width//3, mouth_y-10, 2*width//3, mouth_y+10], 0, 180, fill=(0, 0, 0), width=3)
        
        # Convert to base64
        import io
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return image_data
    
    def test_face_detection(self) -> dict:
        """Test face detection functionality."""
        print("\n" + "="*50)
        print("TESTING FACE DETECTION")
        print("="*50)
        
        try:
            # Create test image
            test_image = self.create_test_image()
            
            # Test face detection
            result = self.system.detect_face(test_image)
            
            success = result.get('face_detected', False)
            
            print(f"Face detection test: {'✓ PASSED' if success else '✗ FAILED'}")
            if success:
                print(f"  Faces detected: {result.get('num_faces', 0)}")
                print(f"  Image dimensions: {result.get('image_dimensions', 'Unknown')}")
            else:
                print(f"  Error: {result.get('error', 'Unknown error')}")
            
            return {
                'test_name': 'face_detection',
                'success': success,
                'result': result
            }
            
        except Exception as e:
            print(f"Face detection test: ✗ FAILED - {e}")
            return {
                'test_name': 'face_detection',
                'success': False,
                'error': str(e)
            }
    
    def test_liveness_detection(self) -> dict:
        """Test liveness detection functionality."""
        print("\n" + "="*50)
        print("TESTING LIVENESS DETECTION")
        print("="*50)
        
        try:
            # Create test image
            test_image = self.create_test_image()
            
            # Test liveness detection
            result = self.system.detect_liveness(test_image)
            
            success = 'liveness_score' in result
            
            print(f"Liveness detection test: {'✓ PASSED' if success else '✗ FAILED'}")
            if success:
                print(f"  Liveness score: {result.get('liveness_score', 0)}/100")
                print(f"  Is live: {result.get('is_live', False)}")
                print(f"  Confidence: {result.get('confidence', 'unknown')}")
            else:
                print(f"  Error: {result.get('error', 'Unknown error')}")
            
            return {
                'test_name': 'liveness_detection',
                'success': success,
                'result': result
            }
            
        except Exception as e:
            print(f"Liveness detection test: ✗ FAILED - {e}")
            return {
                'test_name': 'liveness_detection',
                'success': False,
                'error': str(e)
            }
    
    def test_face_vectorization(self) -> dict:
        """Test face vectorization functionality."""
        print("\n" + "="*50)
        print("TESTING FACE VECTORIZATION")
        print("="*50)
        
        try:
            # Create test image
            test_image = self.create_test_image()
            
            # Test face vectorization
            result = self.system.vectorize_face(test_image, "TestPerson")
            
            success = result.get('success', False)
            
            print(f"Face vectorization test: {'✓ PASSED' if success else '✗ FAILED'}")
            if success:
                print(f"  Face ID: {result.get('face_id', 'Unknown')}")
                print(f"  Person name: {result.get('person_name', 'Unknown')}")
                print(f"  Encoding dimension: {result.get('encoding_dimension', 0)}")
                print(f"  Vector magnitude: {result.get('vector_magnitude', 0):.4f}")
            else:
                print(f"  Error: {result.get('error', 'Unknown error')}")
            
            return {
                'test_name': 'face_vectorization',
                'success': success,
                'result': result
            }
            
        except Exception as e:
            print(f"Face vectorization test: ✗ FAILED - {e}")
            return {
                'test_name': 'face_vectorization',
                'success': False,
                'error': str(e)
            }
    
    def test_face_comparison(self) -> dict:
        """Test face comparison functionality."""
        print("\n" + "="*50)
        print("TESTING FACE COMPARISON")
        print("="*50)
        
        try:
            # Create two test images
            test_image1 = self.create_test_image(color=(150, 150, 150))
            test_image2 = self.create_test_image(color=(100, 100, 100))
            
            # Vectorize both faces
            result1 = self.system.vectorize_face(test_image1, "Person1")
            result2 = self.system.vectorize_face(test_image2, "Person2")
            
            if not result1['success'] or not result2['success']:
                return {
                    'test_name': 'face_comparison',
                    'success': False,
                    'error': 'Failed to vectorize test faces'
                }
            
            # Compare faces
            comparison = self.system.compare_faces(result1['face_id'], result2['face_id'])
            
            success = comparison.get('success', False)
            
            print(f"Face comparison test: {'✓ PASSED' if success else '✗ FAILED'}")
            if success:
                print(f"  Person 1: {comparison.get('person1', 'Unknown')}")
                print(f"  Person 2: {comparison.get('person2', 'Unknown')}")
                print(f"  Distance: {comparison.get('distance', 0):.4f}")
                print(f"  Is match: {comparison.get('is_match', False)}")
                print(f"  Similarity: {comparison.get('similarity_percentage', 0):.1f}%")
            else:
                print(f"  Error: {comparison.get('error', 'Unknown error')}")
            
            return {
                'test_name': 'face_comparison',
                'success': success,
                'result': comparison
            }
            
        except Exception as e:
            print(f"Face comparison test: ✗ FAILED - {e}")
            return {
                'test_name': 'face_comparison',
                'success': False,
                'error': str(e)
            }
    
    def test_comparison_matrix(self) -> dict:
        """Test comparison matrix generation."""
        print("\n" + "="*50)
        print("TESTING COMPARISON MATRIX")
        print("="*50)
        
        try:
            # Create multiple test images
            test_images = []
            for i in range(3):
                color = (100 + i*50, 100 + i*50, 100 + i*50)
                test_image = self.create_test_image(color=color)
                result = self.system.vectorize_face(test_image, f"TestPerson{i+1}")
                if result['success']:
                    test_images.append(result['face_id'])
            
            if len(test_images) < 2:
                return {
                    'test_name': 'comparison_matrix',
                    'success': False,
                    'error': 'Not enough test faces for matrix generation'
                }
            
            # Generate comparison matrix
            matrix_result = self.system.generate_comparison_matrix()
            
            success = matrix_result.get('success', False)
            
            print(f"Comparison matrix test: {'✓ PASSED' if success else '✗ FAILED'}")
            if success:
                print(f"  Number of faces: {matrix_result.get('num_faces', 0)}")
                print(f"  Person names: {matrix_result.get('person_names', [])}")
                stats = matrix_result.get('statistics', {})
                print(f"  Min distance: {stats.get('min_distance', 0):.4f}")
                print(f"  Max distance: {stats.get('max_distance', 0):.4f}")
                print(f"  Mean distance: {stats.get('mean_distance', 0):.4f}")
            else:
                print(f"  Error: {matrix_result.get('error', 'Unknown error')}")
            
            return {
                'test_name': 'comparison_matrix',
                'success': success,
                'result': matrix_result
            }
            
        except Exception as e:
            print(f"Comparison matrix test: ✗ FAILED - {e}")
            return {
                'test_name': 'comparison_matrix',
                'success': False,
                'error': str(e)
            }
    
    def test_complete_analysis(self) -> dict:
        """Test complete image analysis workflow."""
        print("\n" + "="*50)
        print("TESTING COMPLETE ANALYSIS WORKFLOW")
        print("="*50)
        
        try:
            # Create test image
            test_image = self.create_test_image()
            
            # Run complete analysis
            result = self.system.analyze_image(test_image, "TestPerson")
            
            success = result.get('success', False)
            
            print(f"Complete analysis test: {'✓ PASSED' if success else '✗ FAILED'}")
            if success:
                print(f"  Person name: {result.get('person_name', 'Unknown')}")
                print(f"  Face ID: {result.get('face_id', 'Unknown')}")
                
                face_detection = result.get('face_detection', {})
                print(f"  Face detected: {face_detection.get('face_detected', False)}")
                
                liveness = result.get('liveness_detection', {})
                print(f"  Liveness score: {liveness.get('liveness_score', 0)}/100")
                
                quality = result.get('quality_assessment', {})
                print(f"  Quality: {quality.get('overall_quality', 'unknown')}")
            else:
                print(f"  Error: {result.get('error', 'Unknown error')}")
            
            return {
                'test_name': 'complete_analysis',
                'success': success,
                'result': result
            }
            
        except Exception as e:
            print(f"Complete analysis test: ✗ FAILED - {e}")
            return {
                'test_name': 'complete_analysis',
                'success': False,
                'error': str(e)
            }
    
    def run_all_tests(self) -> dict:
        """Run all tests and generate a comprehensive report."""
        print("="*60)
        print("FACE RECOGNITION SYSTEM TEST SUITE")
        print("="*60)
        print("Testing all components of the face recognition system...")
        
        tests = [
            self.test_face_detection,
            self.test_liveness_detection,
            self.test_face_vectorization,
            self.test_face_comparison,
            self.test_comparison_matrix,
            self.test_complete_analysis
        ]
        
        results = []
        passed = 0
        failed = 0
        
        for test_func in tests:
            try:
                result = test_func()
                results.append(result)
                if result['success']:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                results.append({
                    'test_name': test_func.__name__,
                    'success': False,
                    'error': str(e)
                })
                failed += 1
        
        # Generate summary
        summary = {
            'total_tests': len(tests),
            'passed': passed,
            'failed': failed,
            'success_rate': (passed / len(tests)) * 100,
            'test_results': results
        }
        
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Success rate: {summary['success_rate']:.1f}%")
        
        if summary['success_rate'] >= 80:
            print("\n✓ System is ready for face analysis!")
            print("You can now process your friends' images.")
        elif summary['success_rate'] >= 60:
            print("\n⚠ System has some issues but may work for basic analysis.")
            print("Check the failed tests and consider fixing them.")
        else:
            print("\n✗ System has significant issues.")
            print("Please fix the failed tests before processing images.")
        
        return summary
    
    def save_test_results(self, filename: str = "test_results.json"):
        """Save test results to a file."""
        try:
            summary = self.run_all_tests()
            
            with open(filename, 'w') as f:
                json.dump(summary, f, indent=2, default=str)
            
            print(f"\n✓ Test results saved to: {filename}")
            return True
            
        except Exception as e:
            print(f"✗ Failed to save test results: {e}")
            return False

def main():
    """Main function for running tests."""
    print("Face Recognition System Test Suite")
    print("==================================")
    print("This will test all components of the face recognition system.")
    print()
    
    tester = FaceSystemTester()
    
    # Run all tests
    summary = tester.run_all_tests()
    
    # Save results
    tester.save_test_results()
    
    # Return appropriate exit code
    if summary['success_rate'] >= 80:
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())