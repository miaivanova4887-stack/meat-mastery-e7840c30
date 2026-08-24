/**
 * Health Connect Capacitor Plugin — Android Build Config
 * 
 * SETUP INSTRUCTIONS (after `npx cap add android`):
 * 
 * 1. Copy HealthConnectPlugin.kt to:
 *    android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
 * 
 * 2. Add these dependencies to android/app/build.gradle:
 *    implementation "androidx.health.connect:connect-client:1.1.0-alpha10"
 *    implementation "androidx.activity:activity-ktx:1.9.3"
 * 
 * 3. Register the plugin in android/app/src/main/java/.../MainActivity.java:
 *    import app.lovable.plugins.healthconnect.HealthConnectPlugin;
 *    // inside init block:
 *    registerPlugin(HealthConnectPlugin.class);
 * 
 * 4. Add to AndroidManifest.xml inside <manifest>:
 *    <uses-permission android:name="android.permission.health.READ_STEPS"/>
 *    <uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
 *    <uses-permission android:name="android.permission.health.READ_WEIGHT"/>
 * 
 *    And inside <application>:
 *    <!-- Required: tells Android your app uses Health Connect permissions -->
 *    <activity-alias
 *        android:name="ViewPermissionUsageActivity"
 *        android:exported="true"
 *        android:targetActivity=".MainActivity"
 *        android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
 *        <intent-filter>
 *            <action android:name="android.intent.action.VIEW_PERMISSION_USAGE"/>
 *            <category android:name="android.intent.category.HEALTH_PERMISSIONS"/>
 *        </intent-filter>
 *    </activity-alias>
 * 
 *    <!-- For pre-API 34 devices that have Health Connect app installed -->
 *    <queries>
 *        <package android:name="com.google.android.apps.healthdata"/>
 *    </queries>
 * 
 * 5. For Android 16 (16KB page alignment), in gradle.properties:
 *    android.experimental.art.profileGuidedPageAlignment=true
 *    
 *    And in android/app/build.gradle:
 *    android {
 *        defaultConfig {
 *            ndk {
 *                abiFilters "arm64-v8a", "x86_64"
 *            }
 *        }
 *        packagingOptions {
 *            jniLibs {
 *                useLegacyPackaging = false
 *            }
 *        }
 *    }
 * 
 * 6. Set compileSdk to at least 36 in android/app/build.gradle:
 *    android {
 *        compileSdk 36
 *        defaultConfig {
 *            targetSdkVersion 36
 *        }
 *    }
 */

// This file is for reference only — actual build config lives in android/app/build.gradle
