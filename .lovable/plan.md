I’ll implement the Android Google OAuth fix by changing only the native OAuth path while leaving web behavior intact.

Plan:

1. Add the Capacitor Browser plugin if missing
   - `@capacitor/browser` is not currently in `package.json` or `node_modules`.
   - I’ll add it as a dependency so native code can open/close the in-app browser correctly.

2. Update `src/pages/Auth.tsx`
   - Import `Browser` from `@capacitor/browser`.
   - Import the existing auth client from `@/integrations/supabase/client` for the native-only manual OAuth URL flow.
   - Keep Apple hidden on Android exactly as it is now.
   - Keep the web path unchanged, using the current `lovable.auth.signInWithOAuth(...)` flow and web redirect URL.
   - For native platforms:
     - Use `redirectTo = "carnivorex://auth/callback"`.
     - Call:
       ```ts
       supabase.auth.signInWithOAuth({
         provider,
         options: {
           redirectTo,
           skipBrowserRedirect: true,
         },
       })
       ```
     - Log the native OAuth result/error, including whether `data.url` exists.
     - If `data.url` exists, call:
       ```ts
       await Browser.open({ url: data.url, windowName: "_self" })
       ```
     - Log:
       ```ts
       oauth:browser-open { url: redacted }
       ```
   - I’ll use the existing `redactUrl` helper so OAuth URLs are not printed raw.

3. Update `src/hooks/useDeepLinks.ts`
   - Import `Browser` from `@capacitor/browser`.
   - When `appUrlOpen` / launch URL routes an auth callback with `pathname === "/auth/callback"`, call `Browser.close()` after the callback is received and before/around routing into React Router.
   - Add a diagnostic log for the browser close outcome, e.g. `oauth:browser-close` or `oauth:browser-close-error`.
   - Keep the existing `appUrlOpen`, `deeplink:received`, and `/auth/callback` routing logic intact.

4. Bump build markers
   - Update `src/main.tsx`:
     - `authFlow=v5-manifest-fix` → `authFlow=v6-browser-plugin`
   - Update `scripts/build-android-fresh.sh`:
     - Required marker changes to `authFlow=v6-browser-plugin`.
     - Post-install hint changes to `v6-browser-plugin`.
     - Add `oauth:browser-open` to required markers so stale APKs fail early.

5. Native sync consideration
   - Adding `@capacitor/browser` requires the native Android project to be synced before rebuilding.
   - I’ll update the project files here; after approval and implementation, you should run your fresh APK script as usual. If your local checkout doesn’t automatically sync native dependencies, run `npx cap sync android` before the APK build.

Expected log path after rebuild:

```text
[BuildInfo] ... authFlow=v6-browser-plugin
[AuthVerify] oauth:click {"provider":"google","platform":"android","isNative":true}
[AuthVerify] oauth:redirect-uri {"redirectTo":"carnivorex://auth/callback"}
[AuthVerify] oauth:signIn-result {"provider":"google","hasUrl":true,...}
[AuthVerify] oauth:browser-open {"url":"https://...redacted..."}
[AuthVerify] deeplink:appUrlOpen {"redacted":"carnivorex://auth/callback?code=[redacted:...]"}
[AuthVerify] deeplink:received {"pathname":"/auth/callback","isAuthRoute":true,...}
[AuthVerify] oauth:browser-close {...}
[AuthVerify] oauth:exchange-call {...}
[AuthVerify] oauth:exchange-result {"hasSession":true,...}
```