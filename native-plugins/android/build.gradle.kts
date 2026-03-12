/**
 * Health Connect Capacitor Plugin — Android Build Config
 * 
 * SETUP INSTRUCTIONS:
 * After running `npx cap add android`, copy the contents of this
 * native-plugins/android/ directory into your Android project:
 * 
 * 1. Copy HealthConnectPlugin.kt to:
 *    android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
 * 
 * 2. Add these dependencies to android/app/build.gradle:
 *    implementation "androidx.health.connect:connect-client:1.1.0-alpha10"
 * 
 * 3. Register the plugin in android/app/src/main/java/.../MainActivity.java:
 *    import app.lovable.plugins.healthconnect.HealthConnectPlugin;
 *    // inside onCreate or init block:
 *    registerPlugin(HealthConnectPlugin.class);
 * 
 * 4. Add to AndroidManifest.xml inside <manifest>:
 *    <uses-permission android:name="android.permission.health.READ_STEPS"/>
 *    <uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
 *    <uses-permission android:name="android.permission.health.READ_WEIGHT"/>
 *    
 *    And inside <application>:
 *    <activity
 *        android:name="androidx.health.connect.client.impl.platform.HealthConnectPermissionActivity"
 *        android:exported="true">
 *        <intent-filter>
 *            <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
 *        </intent-filter>
 *    </activity>
 * 
 * 5. For Android 16 (16KB page alignment), ensure in gradle.properties:
 *    android.experimental.art.profileGuidedPageAlignment=true
 *    
 *    And in build.gradle set:
 *    android {
 *        defaultConfig {
 *            ndk {
 *                // Only use ABIs that support 16KB pages
 *                abiFilters "arm64-v8a", "x86_64"
 *            }
 *        }
 *        packagingOptions {
 *            jniLibs {
 *                useLegacyPackaging = false
 *            }
 *        }
 *    }
 */

// This file is for reference only — actual build config lives in android/app/build.gradle
