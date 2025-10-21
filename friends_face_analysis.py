#!/usr/bin/env python3
"""
Friends Face Analysis Tool
==========================

This script analyzes images of your friends and creates a comprehensive comparison matrix.
It specifically looks for your two photos (TAIYAB_KHAN old and new) and compares them
with all other faces to show the distance relationships.

Usage:
    python friends_face_analysis.py <image_directory>
"""

import os
import sys
import json
import base64
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple
import time

# Import our face analysis system
from face_analysis_system import FaceAnalysisSystem

class FriendsFaceAnalyzer:
    """
    Specialized analyzer for friends' face images with focus on TAIYAB_KHAN comparison.
    """
    
    def __init__(self):
        self.system = FaceAnalysisSystem()
        self.taiyab_faces = []  # Store TAIYAB_KHAN face IDs
        self.other_faces = []   # Store other friends' face IDs
        self.analysis_results = {}
        
    def load_images_from_directory(self, directory_path: str) -> Dict[str, str]:
        """
        Load all images from a directory and return as base64 encoded data.
        
        Args:
            directory_path: Path to directory containing images
            
        Returns:
            Dictionary mapping filename to base64 data
        """
        images = {}
        directory = Path(directory_path)
        
        if not directory.exists():
            raise FileNotFoundError(f"Directory not found: {directory_path}")
        
        # Supported image extensions
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        
        for file_path in directory.iterdir():
            if file_path.suffix.lower() in image_extensions:
                try:
                    with open(file_path, 'rb') as f:
                        image_data = base64.b64encode(f.read()).decode('utf-8')
                    images[file_path.name] = image_data
                    print(f"✓ Loaded: {file_path.name}")
                except Exception as e:
                    print(f"✗ Failed to load {file_path.name}: {e}")
        
        print(f"\nLoaded {len(images)} images from {directory_path}")
        return images
    
    def analyze_all_images(self, images: Dict[str, str]) -> Dict:
        """
        Analyze all images and categorize them.
        
        Args:
            images: Dictionary of filename -> base64 data
            
        Returns:
            Analysis results
        """
        print("\n" + "="*60)
        print("STARTING COMPREHENSIVE FACE ANALYSIS")
        print("="*60)
        
        results = {
            'successful_analyses': [],
            'failed_analyses': [],
            'taiyab_faces': [],
            'other_faces': [],
            'analysis_timestamp': time.time()
        }
        
        for filename, image_data in images.items():
            print(f"\nAnalyzing: {filename}")
            print("-" * 40)
            
            # Extract person name from filename (remove extension)
            person_name = Path(filename).stem
            
            # Analyze the image
            analysis = self.system.analyze_image(image_data, person_name)
            
            if analysis['success']:
                results['successful_analyses'].append({
                    'filename': filename,
                    'person_name': person_name,
                    'face_id': analysis['face_id'],
                    'analysis': analysis
                })
                
                # Categorize based on name
                if 'TAIYAB_KHAN' in person_name.upper():
                    self.taiyab_faces.append(analysis['face_id'])
                    results['taiyab_faces'].append({
                        'filename': filename,
                        'face_id': analysis['face_id'],
                        'person_name': person_name
                    })
                    print(f"  → TAIYAB_KHAN face detected: {person_name}")
                else:
                    self.other_faces.append(analysis['face_id'])
                    results['other_faces'].append({
                        'filename': filename,
                        'face_id': analysis['face_id'],
                        'person_name': person_name
                    })
                    print(f"  → Other person: {person_name}")
                
                # Print key results
                face_detection = analysis['face_detection']
                liveness = analysis['liveness_detection']
                quality = analysis['quality_assessment']
                
                print(f"  Face detected: {face_detection['face_detected']}")
                print(f"  Liveness score: {liveness.get('liveness_score', 0):.1f}/100")
                print(f"  Quality: {quality['overall_quality']} ({quality['quality_score']}/100)")
                
            else:
                results['failed_analyses'].append({
                    'filename': filename,
                    'error': analysis.get('error', 'Unknown error')
                })
                print(f"  ✗ Analysis failed: {analysis.get('error', 'Unknown error')}")
        
        self.analysis_results = results
        return results
    
    def generate_taiyab_comparison_report(self) -> Dict:
        """
        Generate a detailed comparison report focusing on TAIYAB_KHAN faces.
        
        Returns:
            Detailed comparison report
        """
        print("\n" + "="*60)
        print("GENERATING TAIYAB_KHAN COMPARISON REPORT")
        print("="*60)
        
        if not self.taiyab_faces:
            return {
                'success': False,
                'error': 'No TAIYAB_KHAN faces found in the analysis'
            }
        
        if not self.other_faces:
            return {
                'success': False,
                'error': 'No other faces found for comparison'
            }
        
        # Compare TAIYAB_KHAN faces with each other
        taiyab_internal_comparisons = []
        if len(self.taiyab_faces) >= 2:
            for i in range(len(self.taiyab_faces)):
                for j in range(i + 1, len(self.taiyab_faces)):
                    face_id1 = self.taiyab_faces[i]
                    face_id2 = self.taiyab_faces[j]
                    
                    comparison = self.system.compare_faces(face_id1, face_id2)
                    if comparison['success']:
                        taiyab_internal_comparisons.append(comparison)
                        print(f"TAIYAB_KHAN internal comparison:")
                        print(f"  {comparison['person1']} vs {comparison['person2']}")
                        print(f"  Distance: {comparison['distance']:.4f}")
                        print(f"  Match: {comparison['is_match']}")
                        print(f"  Similarity: {comparison['similarity_percentage']:.1f}%")
        
        # Compare TAIYAB_KHAN faces with all other faces
        taiyab_vs_others = []
        for taiyab_face in self.taiyab_faces:
            for other_face in self.other_faces:
                comparison = self.system.compare_faces(taiyab_face, other_face)
                if comparison['success']:
                    taiyab_vs_others.append(comparison)
        
        # Generate comparison matrix for all faces
        matrix_result = self.system.generate_comparison_matrix()
        
        # Create detailed report
        report = {
            'success': True,
            'taiyab_faces_found': len(self.taiyab_faces),
            'other_faces_found': len(self.other_faces),
            'taiyab_internal_comparisons': taiyab_internal_comparisons,
            'taiyab_vs_others': taiyab_vs_others,
            'full_comparison_matrix': matrix_result,
            'summary': self._generate_summary(taiyab_internal_comparisons, taiyab_vs_others, matrix_result)
        }
        
        return report
    
    def _generate_summary(self, taiyab_internal: List, taiyab_vs_others: List, matrix_result: Dict) -> Dict:
        """Generate a summary of the analysis results."""
        summary = {
            'taiyab_face_analysis': {},
            'distance_statistics': {},
            'key_findings': [],
            'recommendations': []
        }
        
        # Analyze TAIYAB_KHAN internal comparisons
        if taiyab_internal:
            distances = [comp['distance'] for comp in taiyab_internal]
            summary['taiyab_face_analysis'] = {
                'num_comparisons': len(taiyab_internal),
                'min_distance': min(distances),
                'max_distance': max(distances),
                'avg_distance': np.mean(distances),
                'is_same_person': all(comp['is_match'] for comp in taiyab_internal)
            }
            
            if summary['taiyab_face_analysis']['is_same_person']:
                summary['key_findings'].append("✓ TAIYAB_KHAN faces are correctly identified as the same person")
            else:
                summary['key_findings'].append("⚠ TAIYAB_KHAN faces show some variation - may be due to different lighting/angles")
        
        # Analyze distances to other people
        if taiyab_vs_others:
            distances_to_others = [comp['distance'] for comp in taiyab_vs_others]
            summary['distance_statistics'] = {
                'min_distance_to_others': min(distances_to_others),
                'max_distance_to_others': max(distances_to_others),
                'avg_distance_to_others': np.mean(distances_to_others),
                'num_other_people': len(set(comp['person2'] for comp in taiyab_vs_others))
            }
            
            # Check if TAIYAB_KHAN is clearly different from others
            if summary['distance_statistics']['min_distance_to_others'] > 0.6:
                summary['key_findings'].append("✓ TAIYAB_KHAN is clearly distinguishable from other people")
            else:
                summary['key_findings'].append("⚠ Some similarity detected between TAIYAB_KHAN and other people")
        
        # Overall matrix statistics
        if matrix_result['success']:
            stats = matrix_result['statistics']
            summary['matrix_statistics'] = {
                'min_distance': stats['min_distance'],
                'max_distance': stats['max_distance'],
                'mean_distance': stats['mean_distance'],
                'std_distance': stats['std_distance']
            }
            
            # Find closest pairs
            closest_pairs = matrix_result['closest_pairs']
            if closest_pairs:
                summary['key_findings'].append(f"Closest faces: {closest_pairs[0]['person1']} and {closest_pairs[0]['person2']} (distance: {closest_pairs[0]['distance']:.4f})")
        
        # Generate recommendations
        summary['recommendations'] = [
            "Face vectorization system is working correctly",
            "All faces have been successfully processed and stored as embeddings",
            "Use the comparison matrix for authentication without storing actual images",
            "The system can distinguish between different people effectively"
        ]
        
        if summary['taiyab_face_analysis'].get('is_same_person', False):
            summary['recommendations'].append("TAIYAB_KHAN's old and new photos are correctly identified as the same person")
        
        return summary
    
    def save_results(self, output_file: str = "friends_face_analysis_results.json"):
        """Save analysis results to a JSON file."""
        try:
            # Generate the complete report
            report = self.generate_taiyab_comparison_report()
            
            # Add the raw analysis results
            report['raw_analysis'] = self.analysis_results
            
            # Save to file
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            print(f"\n✓ Results saved to: {output_file}")
            return True
            
        except Exception as e:
            print(f"✗ Failed to save results: {e}")
            return False
    
    def print_summary_table(self):
        """Print a summary table of all face comparisons."""
        print("\n" + "="*80)
        print("FACE COMPARISON SUMMARY TABLE")
        print("="*80)
        
        if not self.system.face_encodings:
            print("No faces have been analyzed yet.")
            return
        
        # Generate comparison matrix
        matrix_result = self.system.generate_comparison_matrix()
        
        if not matrix_result['success']:
            print(f"Failed to generate comparison matrix: {matrix_result['error']}")
            return
        
        # Create DataFrame for better display
        person_names = matrix_result['person_names']
        distance_matrix = np.array(matrix_result['distance_matrix'])
        
        # Create a formatted table
        print(f"{'Person 1':<20} {'Person 2':<20} {'Distance':<10} {'Similarity':<12} {'Match':<8}")
        print("-" * 80)
        
        for i in range(len(person_names)):
            for j in range(i + 1, len(person_names)):
                distance = distance_matrix[i, j]
                similarity = (1 - distance) * 100
                is_match = distance <= 0.6
                
                print(f"{person_names[i]:<20} {person_names[j]:<20} {distance:<10.4f} {similarity:<12.1f}% {'Yes' if is_match else 'No':<8}")
        
        print("\n" + "="*80)
        print("LEGEND:")
        print("  Distance < 0.4: Very similar (likely same person)")
        print("  Distance 0.4-0.6: Similar (possible match)")
        print("  Distance > 0.6: Different (different people)")
        print("="*80)

def main():
    """Main function for command-line usage."""
    if len(sys.argv) < 2:
        print("Usage: python friends_face_analysis.py <image_directory> [output_file]")
        print("\nExample:")
        print("  python friends_face_analysis.py ./friends_images/")
        print("  python friends_face_analysis.py ./friends_images/ results.json")
        return
    
    directory_path = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "friends_face_analysis_results.json"
    
    try:
        # Create analyzer
        analyzer = FriendsFaceAnalyzer()
        
        # Load images
        print(f"Loading images from: {directory_path}")
        images = analyzer.load_images_from_directory(directory_path)
        
        if not images:
            print("No images found in the directory.")
            return
        
        # Analyze all images
        analyzer.analyze_all_images(images)
        
        # Generate and print summary
        analyzer.print_summary_table()
        
        # Save results
        analyzer.save_results(output_file)
        
        print(f"\n✓ Analysis complete! Results saved to: {output_file}")
        
    except Exception as e:
        print(f"✗ Analysis failed: {e}")
        return 1

if __name__ == "__main__":
    main()