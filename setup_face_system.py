#!/usr/bin/env python3
"""
Face Recognition System Setup Script
====================================

This script sets up the face recognition system by:
1. Installing required dependencies
2. Testing the installation
3. Creating necessary directories
4. Providing usage instructions

Usage:
    python setup_face_system.py
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def run_command(command, description):
    """Run a command and return success status."""
    print(f"Running: {description}")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ {description} - Success")
            return True
        else:
            print(f"✗ {description} - Failed")
            print(f"  Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"✗ {description} - Exception: {e}")
        return False

def check_python_version():
    """Check if Python version is compatible."""
    print("Checking Python version...")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"✓ Python {version.major}.{version.minor}.{version.micro} - Compatible")
        return True
    else:
        print(f"✗ Python {version.major}.{version.minor}.{version.micro} - Requires Python 3.8+")
        return False

def install_dependencies():
    """Install required Python packages."""
    print("\nInstalling Python dependencies...")
    
    # Check if requirements.txt exists
    requirements_file = Path("requirements.txt")
    if requirements_file.exists():
        success = run_command(
            f"pip install -r {requirements_file}",
            "Installing packages from requirements.txt"
        )
    else:
        # Install packages individually
        packages = [
            "opencv-python>=4.8.0",
            "Pillow>=9.5",
            "numpy>=1.23",
            "pandas>=1.5.0",
            "deepface>=0.0.90",
            "tensorflow>=2.16.0"
        ]
        
        success = True
        for package in packages:
            if not run_command(f"pip install {package}", f"Installing {package}"):
                success = False
    
    return success

def create_directories():
    """Create necessary directories for the system."""
    print("\nCreating directories...")
    
    directories = [
        "test_images",
        "processed_images", 
        "analysis_results",
        "face_embeddings"
    ]
    
    success = True
    for directory in directories:
        try:
            Path(directory).mkdir(exist_ok=True)
            print(f"✓ Created directory: {directory}")
        except Exception as e:
            print(f"✗ Failed to create directory {directory}: {e}")
            success = False
    
    return success

def test_imports():
    """Test if all required modules can be imported."""
    print("\nTesting imports...")
    
    modules = [
        ("cv2", "OpenCV"),
        ("PIL", "Pillow"),
        ("numpy", "NumPy"),
        ("pandas", "Pandas"),
        ("json", "JSON"),
        ("base64", "Base64"),
        ("pathlib", "Pathlib")
    ]
    
    success = True
    for module_name, display_name in modules:
        try:
            __import__(module_name)
            print(f"✓ {display_name} - Available")
        except ImportError as e:
            print(f"✗ {display_name} - Not available: {e}")
            success = False
    
    # Test optional modules
    optional_modules = [
        ("deepface", "DeepFace"),
        ("tensorflow", "TensorFlow")
    ]
    
    for module_name, display_name in optional_modules:
        try:
            __import__(module_name)
            print(f"✓ {display_name} - Available (Optional)")
        except ImportError:
            print(f"⚠ {display_name} - Not available (Optional - some features may be limited)")
    
    return success

def create_sample_config():
    """Create a sample configuration file."""
    print("\nCreating sample configuration...")
    
    config = {
        "face_recognition": {
            "tolerance": 0.6,
            "encoding_dimension": 128,
            "min_face_size": [100, 100],
            "optimal_image_size": [512, 512]
        },
        "liveness_detection": {
            "enabled": True,
            "min_liveness_score": 70,
            "motion_threshold": 5.0,
            "blink_threshold": 0.25
        },
        "analysis": {
            "save_embeddings": True,
            "generate_reports": True,
            "output_format": "json"
        }
    }
    
    try:
        with open("face_system_config.json", "w") as f:
            json.dump(config, f, indent=2)
        print("✓ Created sample configuration: face_system_config.json")
        return True
    except Exception as e:
        print(f"✗ Failed to create configuration: {e}")
        return False

def create_usage_instructions():
    """Create usage instructions file."""
    print("\nCreating usage instructions...")
    
    instructions = """# Face Recognition System Usage Instructions

## Quick Start

1. **Prepare your images:**
   ```bash
   python image_preprocessor.py ./raw_images/ ./processed_images/
   ```

2. **Run face analysis:**
   ```bash
   python friends_face_analysis.py ./processed_images/
   ```

3. **Test the system:**
   ```bash
   python test_face_system.py
   ```

## Detailed Usage

### 1. Image Preprocessing
The `image_preprocessor.py` script prepares your images for optimal face analysis:
- Converts images to the correct format
- Resizes images for optimal processing
- Validates image quality
- Creates organized directory structure

### 2. Face Analysis
The `friends_face_analysis.py` script performs comprehensive face analysis:
- Detects faces in images
- Performs liveness detection (anti-spoofing)
- Creates face vector embeddings
- Generates comparison matrix
- Focuses on TAIYAB_KHAN face comparisons

### 3. System Testing
The `test_face_system.py` script validates all components:
- Tests face detection
- Tests liveness detection
- Tests face vectorization
- Tests face comparison
- Tests comparison matrix generation

## File Naming Convention

Name your images with person names for better identification:
- `TAIYAB_KHAN_old.jpg` - Your old photo
- `TAIYAB_KHAN_new.jpg` - Your new photo
- `John_Doe.jpg` - Friend's photo
- `Jane_Smith.jpg` - Another friend's photo

## Output Files

The system generates several output files:
- `friends_face_analysis_results.json` - Complete analysis results
- `face_embeddings/` - Directory containing face vector embeddings
- `analysis_results/` - Directory containing detailed reports

## Understanding Results

### Distance Values
- **< 0.4**: Very similar (likely same person)
- **0.4 - 0.6**: Similar (possible match)
- **> 0.6**: Different (different people)

### Liveness Scores
- **70-100**: Live person detected
- **40-69**: Uncertain (may need retry)
- **0-39**: Likely spoofed (photo of photo)

### Quality Assessment
- **Excellent**: Optimal for face recognition
- **Good**: Suitable for face recognition
- **Fair**: May work but not optimal
- **Poor**: Not suitable for face recognition

## Troubleshooting

1. **No face detected**: Ensure face is clearly visible and well-lit
2. **Liveness detection failed**: Use live camera feed, avoid photos of photos
3. **Poor quality**: Improve lighting and hold camera steady
4. **Import errors**: Run `pip install -r requirements.txt`

## Security Notes

- Face embeddings are stored instead of actual images
- Embeddings cannot be reverse-engineered to recreate faces
- System is designed for secure authentication
- No personal images are permanently stored

## Support

If you encounter issues:
1. Run the test suite: `python test_face_system.py`
2. Check the error messages in the output
3. Ensure all dependencies are installed
4. Verify image quality and format
"""
    
    try:
        with open("USAGE_INSTRUCTIONS.md", "w") as f:
            f.write(instructions)
        print("✓ Created usage instructions: USAGE_INSTRUCTIONS.md")
        return True
    except Exception as e:
        print(f"✗ Failed to create usage instructions: {e}")
        return False

def main():
    """Main setup function."""
    print("="*60)
    print("FACE RECOGNITION SYSTEM SETUP")
    print("="*60)
    print("Setting up the face recognition system...")
    print()
    
    # Track setup progress
    setup_steps = []
    
    # Step 1: Check Python version
    if check_python_version():
        setup_steps.append(("Python version check", True))
    else:
        setup_steps.append(("Python version check", False))
        print("✗ Setup failed: Incompatible Python version")
        return 1
    
    # Step 2: Install dependencies
    if install_dependencies():
        setup_steps.append(("Dependency installation", True))
    else:
        setup_steps.append(("Dependency installation", False))
        print("⚠ Warning: Some dependencies may not have installed correctly")
    
    # Step 3: Create directories
    if create_directories():
        setup_steps.append(("Directory creation", True))
    else:
        setup_steps.append(("Directory creation", False))
    
    # Step 4: Test imports
    if test_imports():
        setup_steps.append(("Import testing", True))
    else:
        setup_steps.append(("Import testing", False))
        print("⚠ Warning: Some modules may not be available")
    
    # Step 5: Create configuration
    if create_sample_config():
        setup_steps.append(("Configuration creation", True))
    else:
        setup_steps.append(("Configuration creation", False))
    
    # Step 6: Create instructions
    if create_usage_instructions():
        setup_steps.append(("Instructions creation", True))
    else:
        setup_steps.append(("Instructions creation", False))
    
    # Summary
    print("\n" + "="*60)
    print("SETUP SUMMARY")
    print("="*60)
    
    successful_steps = sum(1 for _, success in setup_steps if success)
    total_steps = len(setup_steps)
    
    for step_name, success in setup_steps:
        status = "✓" if success else "✗"
        print(f"{status} {step_name}")
    
    print(f"\nSetup completed: {successful_steps}/{total_steps} steps successful")
    
    if successful_steps >= total_steps * 0.8:
        print("\n✓ Setup successful! The face recognition system is ready to use.")
        print("\nNext steps:")
        print("1. Place your images in a directory")
        print("2. Run: python image_preprocessor.py <image_directory> <output_directory>")
        print("3. Run: python friends_face_analysis.py <processed_images_directory>")
        print("4. Check the results in the generated JSON file")
        return 0
    else:
        print("\n✗ Setup had issues. Please check the error messages above.")
        print("You may need to install dependencies manually or fix configuration issues.")
        return 1

if __name__ == "__main__":
    sys.exit(main())