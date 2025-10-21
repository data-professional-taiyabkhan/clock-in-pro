#!/usr/bin/env python3
"""
Image Preprocessor for Face Analysis
====================================

This utility helps prepare images for face analysis by:
1. Converting images to the correct format
2. Resizing images for optimal processing
3. Creating a standardized directory structure
4. Validating image quality

Usage:
    python image_preprocessor.py <input_directory> <output_directory>
"""

import os
import sys
import base64
import json
from pathlib import Path
from PIL import Image, ImageOps
import cv2
import numpy as np

class ImagePreprocessor:
    """
    Preprocesses images for optimal face analysis.
    """
    
    def __init__(self):
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        self.optimal_size = (512, 512)  # Optimal size for face analysis
        self.min_face_size = (100, 100)  # Minimum face size for good analysis
        
    def preprocess_image(self, input_path: Path, output_path: Path) -> dict:
        """
        Preprocess a single image for face analysis.
        
        Args:
            input_path: Path to input image
            output_path: Path to save processed image
            
        Returns:
            Dictionary with preprocessing results
        """
        try:
            # Load image
            with Image.open(input_path) as img:
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Auto-orient based on EXIF data
                img = ImageOps.exif_transpose(img)
                
                # Resize while maintaining aspect ratio
                img.thumbnail(self.optimal_size, Image.Resampling.LANCZOS)
                
                # Create a square image with padding if needed
                if img.size[0] != img.size[1]:
                    # Create square canvas
                    size = max(img.size)
                    square_img = Image.new('RGB', (size, size), (255, 255, 255))
                    
                    # Paste original image in center
                    square_img.paste(img, ((size - img.size[0]) // 2, (size - img.size[1]) // 2))
                    img = square_img
                
                # Resize to optimal size
                img = img.resize(self.optimal_size, Image.Resampling.LANCZOS)
                
                # Save processed image
                img.save(output_path, 'JPEG', quality=95, optimize=True)
                
                # Validate the processed image
                validation = self.validate_image(output_path)
                
                return {
                    'success': True,
                    'input_path': str(input_path),
                    'output_path': str(output_path),
                    'original_size': img.size,
                    'processed_size': self.optimal_size,
                    'validation': validation
                }
                
        except Exception as e:
            return {
                'success': False,
                'input_path': str(input_path),
                'error': str(e)
            }
    
    def validate_image(self, image_path: Path) -> dict:
        """
        Validate that an image is suitable for face analysis.
        
        Args:
            image_path: Path to image to validate
            
        Returns:
            Validation results
        """
        try:
            # Load with OpenCV for analysis
            img = cv2.imread(str(image_path))
            if img is None:
                return {'valid': False, 'error': 'Could not load image'}
            
            # Convert to grayscale for analysis
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Check image dimensions
            height, width = gray.shape
            if height < 200 or width < 200:
                return {'valid': False, 'error': 'Image too small for face analysis'}
            
            # Check brightness
            brightness = np.mean(gray)
            if brightness < 30:
                return {'valid': False, 'error': 'Image too dark'}
            elif brightness > 220:
                return {'valid': False, 'error': 'Image too bright'}
            
            # Check contrast
            contrast = np.std(gray)
            if contrast < 15:
                return {'valid': False, 'error': 'Image has too low contrast'}
            
            # Check for potential face (basic detection)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=self.min_face_size)
            
            if len(faces) == 0:
                return {
                    'valid': True, 
                    'warning': 'No face detected - may need manual verification',
                    'brightness': float(brightness),
                    'contrast': float(contrast)
                }
            
            # Get largest face
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            face_area = largest_face[2] * largest_face[3]
            image_area = height * width
            face_ratio = face_area / image_area
            
            return {
                'valid': True,
                'face_detected': True,
                'num_faces': len(faces),
                'face_ratio': float(face_ratio),
                'brightness': float(brightness),
                'contrast': float(contrast),
                'recommendation': 'Good for face analysis' if face_ratio > 0.1 else 'Face may be too small'
            }
            
        except Exception as e:
            return {'valid': False, 'error': f'Validation failed: {str(e)}'}
    
    def preprocess_directory(self, input_dir: Path, output_dir: Path) -> dict:
        """
        Preprocess all images in a directory.
        
        Args:
            input_dir: Input directory containing images
            output_dir: Output directory for processed images
            
        Returns:
            Preprocessing results
        """
        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Find all image files
        image_files = []
        for ext in self.supported_formats:
            image_files.extend(input_dir.glob(f'*{ext}'))
            image_files.extend(input_dir.glob(f'*{ext.upper()}'))
        
        if not image_files:
            return {
                'success': False,
                'error': f'No image files found in {input_dir}',
                'supported_formats': list(self.supported_formats)
            }
        
        results = {
            'success': True,
            'input_directory': str(input_dir),
            'output_directory': str(output_dir),
            'total_images': len(image_files),
            'processed_images': [],
            'failed_images': [],
            'summary': {}
        }
        
        print(f"Processing {len(image_files)} images...")
        
        for i, image_file in enumerate(image_files, 1):
            print(f"Processing {i}/{len(image_files)}: {image_file.name}")
            
            # Create output filename
            output_filename = f"processed_{image_file.stem}.jpg"
            output_path = output_dir / output_filename
            
            # Process image
            result = self.preprocess_image(image_file, output_path)
            
            if result['success']:
                results['processed_images'].append(result)
                print(f"  ✓ Success: {output_filename}")
            else:
                results['failed_images'].append(result)
                print(f"  ✗ Failed: {result['error']}")
        
        # Generate summary
        results['summary'] = {
            'successful': len(results['processed_images']),
            'failed': len(results['failed_images']),
            'success_rate': len(results['processed_images']) / len(image_files) * 100
        }
        
        return results
    
    def create_analysis_ready_directory(self, input_dir: Path, output_dir: Path) -> dict:
        """
        Create a directory structure ready for face analysis.
        
        Args:
            input_dir: Input directory with images
            output_dir: Output directory for organized structure
            
        Returns:
            Organization results
        """
        # Create main output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        processed_dir = output_dir / "processed_images"
        metadata_dir = output_dir / "metadata"
        analysis_dir = output_dir / "analysis_results"
        
        for subdir in [processed_dir, metadata_dir, analysis_dir]:
            subdir.mkdir(exist_ok=True)
        
        # Preprocess images
        preprocess_results = self.preprocess_directory(input_dir, processed_dir)
        
        if not preprocess_results['success']:
            return preprocess_results
        
        # Create metadata file
        metadata = {
            'preprocessing_timestamp': str(pd.Timestamp.now()),
            'input_directory': str(input_dir),
            'output_directory': str(output_dir),
            'preprocessing_results': preprocess_results,
            'instructions': {
                'next_steps': [
                    "Run face analysis on the processed_images directory",
                    "Use friends_face_analysis.py to analyze all images",
                    "Check analysis_results directory for output files"
                ],
                'file_naming': [
                    "Name your images with person names for better identification",
                    "Example: TAIYAB_KHAN_old.jpg, TAIYAB_KHAN_new.jpg, John_Doe.jpg",
                    "The system will extract names from filenames"
                ]
            }
        }
        
        # Save metadata
        metadata_file = metadata_dir / "preprocessing_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        # Create README for the directory
        readme_content = f"""# Face Analysis Directory

This directory contains preprocessed images ready for face analysis.

## Directory Structure
- `processed_images/` - Preprocessed images optimized for face analysis
- `metadata/` - Preprocessing metadata and configuration
- `analysis_results/` - Results from face analysis (will be created)

## Usage
Run the face analysis with:
```bash
python friends_face_analysis.py processed_images/
```

## Image Naming
Name your images with person names for better identification:
- TAIYAB_KHAN_old.jpg
- TAIYAB_KHAN_new.jpg
- John_Doe.jpg
- Jane_Smith.jpg

## Preprocessing Results
- Total images processed: {preprocess_results['summary']['successful']}
- Failed images: {preprocess_results['summary']['failed']}
- Success rate: {preprocess_results['summary']['success_rate']:.1f}%
"""
        
        readme_file = output_dir / "README.md"
        with open(readme_file, 'w') as f:
            f.write(readme_content)
        
        return {
            'success': True,
            'output_directory': str(output_dir),
            'preprocessing_results': preprocess_results,
            'metadata_file': str(metadata_file),
            'readme_file': str(readme_file)
        }

def main():
    """Main function for command-line usage."""
    if len(sys.argv) < 3:
        print("Usage: python image_preprocessor.py <input_directory> <output_directory>")
        print("\nExample:")
        print("  python image_preprocessor.py ./raw_images/ ./processed_images/")
        print("\nThis will:")
        print("  1. Process all images in the input directory")
        print("  2. Optimize them for face analysis")
        print("  3. Create an organized output directory")
        print("  4. Generate metadata and instructions")
        return
    
    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    
    if not input_dir.exists():
        print(f"Error: Input directory does not exist: {input_dir}")
        return 1
    
    try:
        preprocessor = ImagePreprocessor()
        
        print(f"Preprocessing images from: {input_dir}")
        print(f"Output directory: {output_dir}")
        print()
        
        # Create analysis-ready directory
        result = preprocessor.create_analysis_ready_directory(input_dir, output_dir)
        
        if result['success']:
            print(f"\n✓ Preprocessing complete!")
            print(f"  Processed images: {result['preprocessing_results']['summary']['successful']}")
            print(f"  Failed images: {result['preprocessing_results']['summary']['failed']}")
            print(f"  Output directory: {result['output_directory']}")
            print(f"  Metadata file: {result['metadata_file']}")
            print(f"  README file: {result['readme_file']}")
            print(f"\nNext step: Run face analysis with:")
            print(f"  python friends_face_analysis.py {result['output_directory']}/processed_images/")
        else:
            print(f"✗ Preprocessing failed: {result['error']}")
            return 1
            
    except Exception as e:
        print(f"✗ Preprocessing failed: {e}")
        return 1

if __name__ == "__main__":
    main()