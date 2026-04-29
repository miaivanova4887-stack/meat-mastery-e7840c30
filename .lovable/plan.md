## Root cause

The Java compiler error `cannot find symbol class HealthConnectPlugin` is **not** about the plugin file — the file exists at the right path. The cause is that **the Android project has no Kotlin support configured**:

- `android/build.gradle` (root) has no `kotlin-gradle-plugin` classpath
- `android/app/build.gradle` does not apply `kotlin-android`
- No `kotlinOptions { jvmTarget }` block anywhere

So Gradle never compiles `HealthConnectPlugin.kt`. From Java's perspective the package `app.lovable.plugins.healthconnect` is empty, hence `cannot find symbol`.

This is a regression — Kotlin support was lost when the Capacitor Android project was regenerated. We need to put it back.

---

## Plan

### Edit 1 — `android/build.gradle`
Add a Kotlin version variable and the `kotlin-gradle-plugin` classpath inside `buildscript`:

```gradle
buildscript {
    ext.kotlin_version = '1.9.25'

    repositories { google(); mavenCentral() }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.13.0'
        classpath 'com.google.gms:google-services:4.4.4'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}
```

### Edit 2 — `android/app/build.gradle`
- Apply the `kotlin-android` plugin at the top.
- Add a `kotlinOptions { jvmTarget = '21' }` block inside `android {}` so Kotlin matches the existing Java 21 compileOptions in `capacitor.build.gradle`.
- Add `org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version` to dependencies.

```gradle
apply plugin: 'com.android.application'
apply plugin: 'kotlin-android'

android {
    // ... existing config ...
    kotlinOptions { jvmTarget = '21' }
}

dependencies {
    // ... existing ...
    implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"
}
```

### Why this is safe
- Kotlin 1.9.25 is the version already pinned in project memory (Android Platform Constraints).
- JVM target 21 matches `capacitor.build.gradle`'s `sourceCompatibility VERSION_21`.
- AGP 8.13 supports Kotlin Gradle Plugin 1.9.x.
- No source files change — only Gradle wiring is restored so the existing `.kt` plugin compiles.

### Verification commands the user runs
```bash
cd ~/Desktop/carnivore-coach-pro
git pull
cd android && ./gradlew :app:compileDebugKotlin --no-daemon
# expect: BUILD SUCCESSFUL
cd ..
bash scripts/build-android-fresh.sh
```

After install, top-right corner should show `Build … · android · D:Medi`. Tap Setup on Sync Smart Devices → Android system Health permission dialog appears.

## Files touched
- `android/build.gradle` — add Kotlin classpath
- `android/app/build.gradle` — apply `kotlin-android`, add `kotlinOptions`, add stdlib dependency

## Constraints respected
- Kotlin 1.9.25 (matches platform-constraints memory).
- No edits to Supabase config, .env, types, or any source code.
- The recently-patched `HealthConnectPlugin.kt` is left untouched — it will simply now be compiled.
