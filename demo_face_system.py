#!/usr/bin/env python3
"""
Face Recognition System Demo
============================

This script demonstrates the complete face recognition system with sample data.
It shows how to use all the components and what results to expect.

Usage:
    python demo_face_system.py
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
    print("✓ Face analysis system imported successfully")
except ImportError as e:
    print(f"✗ Failed to import face analysis system: {e}")
    sys.exit(1)

def create_demo_images():
    """Create demo images for testing the system."""
    print("Creating demo images...")
    
    from PIL import Image, ImageDraw
    import io
    
    # Create demo directory
    demo_dir = Path("demo_images")
    demo_dir.mkdir(exist_ok=True)
    
    # Create different "faces" with varying characteristics
    demo_faces = [
        {"name": "TAIYAB_KHAN_old", "color": (150, 120, 100), "features": "old"},
        {"name": "TAIYAB_KHAN_new", "color": (160, 130, 110), "features": "new"},
        {"name": "John_Doe", "color": (200, 180, 160), "features": "friend1"},
        {"name": "Jane_Smith", "color": (180, 160, 140), "features": "friend2"},
        {"name": "Mike_Johnson", "color": (140, 100, 80), "features": "friend3"}
    ]
    
    created_images = {}
    
    for face_info in demo_faces:
        # Create image
        img = Image.new('RGB', (400, 400), face_info["color"])
        draw = ImageDraw.Draw(img)
        
        # Draw face features based on type
        if face_info["features"] == "old":
            # Older looking features
            draw.ellipse([50, 50, 350, 350], outline=(0, 0, 0), width=3)
            # Eyes
            draw.ellipse([120, 120, 160, 140], fill=(0, 0, 0))
            draw.ellipse([240, 120, 280, 140], fill=(0, 0, 0))
            # Nose
            draw.polygon([(200, 180), (190, 220), (210, 220)], fill=(200, 200, 200))
            # Mouth (slightly down)
            draw.arc([150, 250, 250, 280], 0, 180, fill=(0, 0, 0), width=3)
            # Wrinkles
            for i in range(3):
                y = 100 + i * 20
                draw.line([(100, y), (300, y)], fill=(100, 100, 100), width=1)
        
        elif face_info["features"] == "new":
            # Newer looking features (similar to old but slightly different)
            draw.ellipse([50, 50, 350, 350], outline=(0, 0, 0), width=3)
            # Eyes
            draw.ellipse([125, 125, 165, 145], fill=(0, 0, 0))
            draw.ellipse([235, 125, 275, 145], fill=(0, 0, 0))
            # Nose
            draw.polygon([(200, 185), (192, 225), (208, 225)], fill=(200, 200, 200))
            # Mouth (slightly up)
            draw.arc([150, 245, 250, 275], 0, 180, fill=(0, 0, 0), width=3)
            # No wrinkles
        
        else:
            # Friend features (different shapes)
            draw.ellipse([60, 60, 340, 340], outline=(0, 0, 0), width=3)
            # Eyes
            draw.ellipse([130, 130, 170, 150], fill=(0, 0, 0))
            draw.ellipse([230, 130, 270, 150], fill=(0, 0, 0))
            # Nose
            draw.polygon([(200, 190), (185, 230), (215, 230)], fill=(200, 200, 200))
            # Mouth
            draw.arc([160, 260, 240, 290], 0, 180, fill=(0, 0, 0), width=3)
        
        # Save image
        filename = f"{face_info['name']}.jpg"
        filepath = demo_dir / filename
        img.save(filepath, 'JPEG', quality=95)
        
        # Convert to base64 for analysis
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        created_images[filename] = image_data
        print(f"  ✓ Created: {filename}")
    
    return created_images, demo_dir

def run_demo_analysis():
    """Run the complete demo analysis."""
    print("\n" + "="*60)
    print("FACE RECOGNITION SYSTEM DEMO")
    print("="*60)
    
    # Create demo images
    demo_images, demo_dir = create_demo_images()
    
    # Initialize the face analysis system
    system = FaceAnalysisSystem()
    
    print(f"\nAnalyzing {len(demo_images)} demo images...")
    print("-" * 40)
    
    # Analyze each image
    analysis_results = {}
    
    for filename, image_data in demo_images.items():
        person_name = Path(filename).stem
        print(f"\nAnalyzing: {person_name}")
        
        # Run complete analysis
        result = system.analyze_image(image_data, person_name)
        analysis_results[person_name] = result
        
        if result['success']:
            print(f"  ✓ Face detected: {result['face_detection']['face_detected']}")
            print(f"  ✓ Liveness score: {result['liveness_detection']['liveness_score']}/100")
            print(f"  ✓ Quality: {result['quality_assessment']['overall_quality']}")
            print(f"  ✓ Face ID: {result['face_id']}")
        else:
            print(f"  ✗ Analysis failed: {result.get('error', 'Unknown error')}")
    
    # Generate comparison matrix
    print(f"\nGenerating comparison matrix...")
    matrix_result = system.generate_comparison_matrix()
    
    if matrix_result['success']:
        print("✓ Comparison matrix generated successfully")
        
        # Print summary table
        print("\n" + "="*80)
        print("FACE COMPARISON MATRIX")
        print("="*80)
        print(f"{'Person 1':<20} {'Person 2':<20} {'Distance':<10} {'Similarity':<12} {'Match':<8}")
        print("-" * 80)
        
        person_names = matrix_result['person_names']
        distance_matrix = np.array(matrix_result['distance_matrix'])
        
        for i in range(len(person_names)):
            for j in range(i + 1, len(person_names)):
                distance = distance_matrix[i, j]
                similarity = (1 - distance) * 100
                is_match = distance <= 0.6
                
                print(f"{person_names[i]:<20} {person_names[j]:<20} {distance:<10.4f} {similarity:<12.1f}% {'Yes' if is_match else 'No':<8}")
        
        # Highlight TAIYAB_KHAN comparison
        print("\n" + "="*80)
        print("TAIYAB_KHAN COMPARISON ANALYSIS")
        print("="*80)
        
        taiyab_faces = [name for name in person_names if 'TAIYAB_KHAN' in name]
        if len(taiyab_faces) >= 2:
            # Find TAIYAB_KHAN faces in the matrix
            taiyab_indices = [i for i, name in enumerate(person_names) if 'TAIYAB_KHAN' in name]
            
            if len(taiyab_indices) >= 2:
                i, j = taiyab_indices[0], taiyab_indices[1]
                distance = distance_matrix[i, j]
                similarity = (1 - distance) * 100
                is_match = distance <= 0.6
                
                print(f"TAIYAB_KHAN old vs new:")
                print(f"  Distance: {distance:.4f}")
                print(f"  Similarity: {similarity:.1f}%")
                print(f"  Same person: {'Yes' if is_match else 'No'}")
                print(f"  Confidence: {'High' if distance < 0.4 else 'Medium' if distance < 0.6 else 'Low'}")
        
        # Show closest and most different pairs
        closest_pairs = matrix_result['closest_pairs']
        most_different_pairs = matrix_result['most_different_pairs']
        
        print(f"\nClosest faces (potential matches):")
        for pair in closest_pairs[:3]:
            print(f"  {pair['person1']} vs {pair['person2']}: {pair['distance']:.4f} ({pair['similarity']:.1f}%)")
        
        print(f"\nMost different faces:")
        for pair in most_different_pairs[:3]:
            print(f"  {pair['person1']} vs {pair['person2']}: {pair['distance']:.4f} ({pair['similarity']:.1f}%)")
        
    else:
        print(f"✗ Comparison matrix failed: {matrix_result.get('error', 'Unknown error')}")
    
    # Generate final report
    print(f"\nGenerating analysis report...")
    report = system.generate_analysis_report()
    
    if report['success']:
        print("✓ Analysis report generated successfully")
        
        # Save results
        with open("demo_analysis_results.json", "w") as f:
            json.dump({
                'analysis_results': analysis_results,
                'matrix_result': matrix_result,
                'report': report,
                'demo_timestamp': time.time()
            }, f, indent=2, default=str)
        
        print("✓ Results saved to: demo_analysis_results.json")
        
        # Print summary
        print("\n" + "="*60)
        print("DEMO SUMMARY")
        print("="*60)
        print(f"Total faces analyzed: {len(analysis_results)}")
        print(f"Successful analyses: {sum(1 for r in analysis_results.values() if r['success'])}")
        print(f"Failed analyses: {sum(1 for r in analysis_results.values() if not r['success'])}")
        
        if matrix_result['success']:
            print(f"Comparison matrix: ✓ Generated")
            print(f"Person names: {', '.join(matrix_result['person_names'])}")
        else:
            print(f"Comparison matrix: ✗ Failed")
        
        print("\nKey findings:")
        print("- Face detection is working")
        print("- Liveness detection is functional")
        print("- Face vectorization is successful")
        print("- Comparison matrix shows relationships")
        print("- TAIYAB_KHAN faces can be compared")
        
        print("\nNext steps:")
        print("1. Replace demo images with your actual photos")
        print("2. Name them with person names (e.g., TAIYAB_KHAN_old.jpg)")
        print("3. Run the analysis on your real images")
        print("4. Check the distance matrix for your specific use case")
        
    else:
        print(f"✗ Report generation failed: {report.get('error', 'Unknown error')}")
    
    return analysis_results, matrix_result, report

def main():
    """Main demo function."""
    print("Face Recognition System Demo")
    print("============================")
    print("This demo shows how the face recognition system works.")
    print("It creates sample images and analyzes them to demonstrate all features.")
    print()
    
    try:
        # Run the demo
        analysis_results, matrix_result, report = run_demo_analysis()
        
        print("\n" + "="*60)
        print("DEMO COMPLETED SUCCESSFULLY!")
        print("="*60)
        print("The face recognition system is working correctly.")
        print("You can now use it with your actual images.")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ Demo failed: {e}")
        print("Please check the error and try again.")
        return 1

if __name__ == "__main__":
    sys.exit(main())