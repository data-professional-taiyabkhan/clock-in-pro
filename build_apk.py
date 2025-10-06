#!/usr/bin/env python3
"""
Simple APK builder for PWA - creates a basic Android wrapper for the web app
"""
import os
import zipfile
import base64
import struct
import hashlib

# APK structure constants
APK_SIGNATURE = b'APK Sig Block 42'

def create_android_manifest():
    """Create a minimal AndroidManifest.xml for the PWA wrapper"""
    # This is a simplified binary Android manifest
    # In a real scenario, this would be compiled from XML using aapt
    manifest = b"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.attendance.management"
    android:versionCode="1"
    android:versionName="1.0">
    
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Attendance"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="localhost" />
            </intent-filter>
        </activity>
    </application>
</manifest>"""
    return manifest

def create_main_activity():
    """Create a basic MainActivity that loads the PWA"""
    # This would normally be compiled Java/Kotlin code
    # For demo purposes, we'll create a placeholder
    activity = b"""
// MainActivity placeholder
// In a real APK, this would be compiled bytecode
// that creates a WebView and loads the PWA URL
"""
    return activity

def create_resources():
    """Create basic resources for the APK"""
    resources = {
        'res/values/strings.xml': b'<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">Attendance</string></resources>',
        'res/mipmap-hdpi/ic_launcher.png': open('client/public/icon-192.png', 'rb').read() if os.path.exists('client/public/icon-192.png') else b'',
        'res/mipmap-xhdpi/ic_launcher.png': open('client/public/icon-512.png', 'rb').read() if os.path.exists('client/public/icon-512.png') else b'',
    }
    return resources

def build_apk():
    """Build a simple APK file"""
    print("Building APK for Attendance Management System...")
    
    # Create build directory
    os.makedirs('build', exist_ok=True)
    
    apk_path = 'build/app-debug.apk'
    
    # Create APK (which is essentially a ZIP file)
    with zipfile.ZipFile(apk_path, 'w', zipfile.ZIP_DEFLATED) as apk:
        # Add AndroidManifest.xml
        apk.writestr('AndroidManifest.xml', create_android_manifest())
        
        # Add MainActivity
        apk.writestr('classes.dex', create_main_activity())
        
        # Add resources
        resources = create_resources()
        for path, content in resources.items():
            if content:
                apk.writestr(path, content)
        
        # Add a basic META-INF directory (required for APK)
        apk.writestr('META-INF/MANIFEST.MF', b'Manifest-Version: 1.0\nCreated-By: PWA Builder\n')
        
        # Add a placeholder certificate (in real scenario, this would be properly signed)
        apk.writestr('META-INF/CERT.SF', b'Signature-Version: 1.0\nCreated-By: PWA Builder\n')
        apk.writestr('META-INF/CERT.RSA', b'[Placeholder certificate]')
    
    # Note: This creates a basic APK structure but it won't be installable without proper signing
    # and compilation of resources. For a production APK, you would need to use proper Android tools.
    
    print(f"\nAPK structure created at: {apk_path}")
    print("\nNOTE: This is a demonstration APK structure. For a functional APK that can be installed")
    print("on Android devices, you would need to:")
    print("1. Use Android SDK tools (aapt, dx, apksigner)")
    print("2. Compile resources and Java/Kotlin code")
    print("3. Properly sign the APK")
    print("\nFor production use, consider using:")
    print("- PWABuilder.com (online service)")
    print("- Bubblewrap CLI with Android SDK installed")
    print("- Android Studio to create a WebView-based app")
    
    # Create a README for the APK
    readme_content = """
# Attendance Management System - Android APK

This directory contains the APK build files for the Attendance Management System PWA.

## Current Status

A basic APK structure has been created at `build/app-debug.apk`. However, this is not a fully functional APK
as it requires proper Android SDK tools for compilation and signing.

## To Create a Functional APK

### Option 1: Use PWABuilder (Recommended for Quick Results)
1. Visit https://www.pwabuilder.com/
2. Enter your PWA URL (when hosted publicly)
3. Follow the steps to generate and download the APK

### Option 2: Use Bubblewrap CLI (Recommended for Automation)
1. Install Android SDK
2. Run: `npx @bubblewrap/cli init --manifest https://your-domain.com/manifest.json`
3. Run: `npx @bubblewrap/cli build`

### Option 3: Manual Android Studio Project
1. Create a new Android project in Android Studio
2. Add a WebView that loads your PWA URL
3. Configure the manifest with necessary permissions
4. Build and sign the APK

## PWA Features Implemented

- ✅ Web App Manifest (`/manifest.json`)
- ✅ Service Worker for offline support (`/sw.js`)
- ✅ App icons (192x192 and 512x512)
- ✅ Theme color and splash screen configuration
- ✅ HTTPS support (required for PWA)

## Testing the PWA

The PWA is currently running at: http://localhost:5000

To test PWA features:
1. Open Chrome/Edge on Android
2. Navigate to your hosted URL
3. You should see an "Install" prompt in the browser
4. The installed PWA will work like a native app
"""
    
    with open('build/README-APK.md', 'w') as f:
        f.write(readme_content)
    
    return apk_path

if __name__ == '__main__':
    apk_path = build_apk()
    print(f"\nAPK structure available at: {os.path.abspath(apk_path)}")
    print(f"README available at: {os.path.abspath('build/README-APK.md')}")