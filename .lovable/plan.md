# Verify and rebuild the Android project

## Goal
Confirm the cloned repository contains the latest Android 16 changes, then produce a clean, verifiable release AAB for Google Play.

## Steps
1. Confirm the clone is on `main`, points to the new GitHub repository, and contains the latest synced commit.
2. Verify the required Android configuration before building:
   - Capacitor 8
   - `minSdkVersion 26`
   - `compileSdkVersion 36`
   - `targetSdkVersion 36`
   - `versionCode 7` or higher
   - Gradle JDK 17
3. Install dependencies from the repository root so required package patches are applied.
4. Run the repository's clean Android build workflow, preserving its SDK self-healing checks.
5. Build the signed release AAB using the local signing configuration.
6. Record evidence: artifact path, file size, SHA-256 checksum, package ID, version code/name, and target SDK extracted from the finished bundle.
7. Stop and report exact corrective commands if signing files, credentials, or expected SDK values are missing; do not submit an unverified artifact.

## Deliverable
A release AAB confirmed to use API 36 and a version code acceptable for the next Google Play upload, with copy-pasteable verification output.
