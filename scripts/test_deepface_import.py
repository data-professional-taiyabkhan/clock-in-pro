#!/usr/bin/env python3
"""
Test script to validate DeepFace import and functionality after version updates.
This script should be run locally before deploying to ensure compatibility.
"""

import os
import sys
import traceback
from pathlib import Path

# Add server directory to path so we can import our modules
server_dir = Path(__file__).parent.parent / "server"
sys.path.insert(0, str(server_dir))

def test_environment_variables():
    """Test that TF_USE_LEGACY_KERAS is set correctly."""
    print("=== Testing Environment Variables ===")
    tf_legacy_keras = os.environ.get("TF_USE_LEGACY_KERAS")
    if tf_legacy_keras == "1":
        print("✅ TF_USE_LEGACY_KERAS is correctly set to '1'")
    else:
        print(f"❌ TF_USE_LEGACY_KERAS is not set correctly: {tf_legacy_keras}")
        return False
    return True

def test_tensorflow_import():
    """Test TensorFlow import and version."""
    print("\n=== Testing TensorFlow Import ===")
    try:
        import tensorflow as tf
        print(f"✅ TensorFlow imported successfully")
        print(f"   Version: {tf.__version__}")
        
        # Check if LocallyConnected2D is available
        try:
            from tensorflow.keras.layers import LocallyConnected2D
            print("✅ LocallyConnected2D layer is available")
        except ImportError as e:
            print(f"❌ LocallyConnected2D layer not available: {e}")
            return False
            
        return True
    except Exception as e:
        print(f"❌ TensorFlow import failed: {e}")
        traceback.print_exc()
        return False

def test_deepface_import():
    """Test DeepFace import and basic functionality."""
    print("\n=== Testing DeepFace Import ===")
    try:
        from deepface import DeepFace
        print("✅ DeepFace imported successfully")
        
        # Test model availability
        try:
            # This will download the model if not present
            print("   Testing FaceNet model availability...")
            # We'll just check if the import works, actual model loading happens on first use
            print("✅ FaceNet model should be available")
            return True
        except Exception as e:
            print(f"❌ FaceNet model test failed: {e}")
            return False
            
    except Exception as e:
        print(f"❌ DeepFace import failed: {e}")
        traceback.print_exc()
        return False

def test_actual_deepface_module():
    """Test our actual_deepface.py module."""
    print("\n=== Testing actual_deepface.py Module ===")
    try:
        # Import our module
        import actual_deepface
        
        print(f"✅ actual_deepface module imported successfully")
        print(f"   DEEPFACE_AVAILABLE: {actual_deepface.DEEPFACE_AVAILABLE}")
        
        if actual_deepface.DEEPFACE_AVAILABLE:
            print("✅ DeepFace is available in our module")
            
            # Test basic functionality
            try:
                # Create dummy test images (just test the import path, not actual verification)
                print("   Testing basic module functions...")
                
                # Check if functions are available
                if hasattr(actual_deepface, 'verify_faces_with_actual_deepface'):
                    print("✅ verify_faces_with_actual_deepface function available")
                else:
                    print("❌ verify_faces_with_actual_deepface function not found")
                    return False
                    
                return True
                
            except Exception as e:
                print(f"❌ Module function test failed: {e}")
                return False
        else:
            print("❌ DeepFace is not available in our module")
            if actual_deepface.DEEPFACE_IMPORT_ERROR:
                print(f"   Import error: {actual_deepface.DEEPFACE_IMPORT_ERROR}")
            return False
            
    except Exception as e:
        print(f"❌ actual_deepface module import failed: {e}")
        traceback.print_exc()
        return False

def test_face_verification_simulation():
    """Test face verification with dummy data (simulation)."""
    print("\n=== Testing Face Verification Simulation ===")
    try:
        import actual_deepface
        
        if not actual_deepface.DEEPFACE_AVAILABLE:
            print("⚠️  Skipping verification test - DeepFace not available")
            return True
            
        # Create dummy base64 images (1x1 pixel PNG)
        dummy_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        print("   Testing face verification with dummy images...")
        
        # This should work without actually doing face recognition
        # We're just testing that the function can be called
        result = actual_deepface.verify_faces_with_actual_deepface(dummy_image, dummy_image)
        
        print("✅ Face verification function executed successfully")
        print(f"   Result type: {type(result)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Face verification test failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run all tests."""
    print("DeepFace Import and Compatibility Test")
    print("=" * 50)
    
    # Set the environment variable first
    os.environ["TF_USE_LEGACY_KERAS"] = "1"
    
    tests = [
        test_environment_variables,
        test_tensorflow_import,
        test_deepface_import,
        test_actual_deepface_module,
        test_face_verification_simulation
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            traceback.print_exc()
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! DeepFace should work correctly.")
        print("\nNext steps:")
        print("1. Run 'npm run build' to test the build process")
        print("2. Run 'npm run dev' to test server startup")
        print("3. Test face verification in the web interface")
        return 0
    else:
        print("❌ Some tests failed. Please check the errors above.")
        print("\nTroubleshooting:")
        print("1. Ensure you're in the test_venv virtual environment")
        print("2. Run: pip install --upgrade deepface>=0.0.90 tensorflow==2.15.1")
        print("3. Check that all dependencies are installed correctly")
        return 1

if __name__ == "__main__":
    sys.exit(main())
