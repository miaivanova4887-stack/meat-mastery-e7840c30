// Hard runtime switch for native FCM. The repo ships without
// android/app/google-services.json, so calling native push registration
// crashes the WebView (no Firebase app initialized). Until that file
// is added to the APK, every native push code path must be a no-op.
//
// Flip this to true ONLY when google-services.json is present in
// android/app/ and verified inside the APK.
export const NATIVE_FCM_ENABLED = false;
