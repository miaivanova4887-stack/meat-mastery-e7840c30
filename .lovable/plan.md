## Root cause (verified, not theory)

I searched the entire `src/`, `index.html`, and `public/` tree for everything you listed — `UTC · web ·`, `BuildStamp`, `__BUILD_TIMESTAMP__`/`__BUILD_FINGERPRINT__` usage in JSX, any `fixed` + `right-2` + `font-mono` + `backdrop-blur` pill, etc. **None of these render the badge in current source.** `__BUILD_*` globals exist only in `src/main.tsx` and are written to `window` + `console.info` only — never to the DOM. `src/App.tsx` mounts `BottomNav` and nothing after it.

I then downloaded the actual JS bundle that `https://app.carnivorex.app/onboarding` is loading (`/assets/index-BSpUEUyU.js`, 2.8 MB) and grepped it. The badge **is** in that bundle:

```js
mVe=()=>{
  const e=Capacitor.getPlatform(),
        t="2026-05-01 20:37:31.620 UTC",
        n="build-1777667851621".replace(/^build-/,"").slice(-8); // -> "67851621"
  return jsxs("div",{
    className:"pointer-events-none fixed right-2 z-50 rounded-md border border-border/70 bg-card/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur font-mono",
    style:{top:"calc(env(safe-area-inset-t...)"},
    ...children: t, " · ", e||"web", " · ", n
  })
}
// mounted in App right after BottomNav:
... jsx(BottomNav,{}), jsx(mVe,{}) ...
```

That matches the screenshot exactly (`2026-05-01 20:37:31.620 UTC · web · 67851621`). The `2026-05-01` timestamp is when this bundle was built — **May 1**. Current source no longer contains this component; it was removed in a previous edit. The deployed asset is simply stale.

Proof:
- `index.html` served by `app.carnivorex.app` still references `index-BSpUEUyU.js` (May 1 build).
- Response header: `x-deployment-id: 61573664-6f65-4bb4-b07e-8eeed7313cc1` — an old deployment.
- The same build is served from `carnivore-coach-pro.lovable.app` (published URL).
- `rg "BuildStamp|fixed right-2 z-50.*backdrop-blur.*font-mono|__BUILD_FINGERPRINT__.*replace"` against `src/` returns **zero** matches.

## What to do

There is **no code change needed** — the badge is already gone from `src/`. The fix is to **republish** so `app.carnivorex.app` and `carnivore-coach-pro.lovable.app` stop serving the May 1 bundle.

After approving this plan, I'll:

1. **Verify once more** (clean re-grep of `src/`, `index.html`, `public/`) to confirm no BuildStamp/VersionStamp/DebugBadge remains in source.
2. **Touch `vite.config.ts`** trivially if needed to bump the cache key — not required, but ensures the Lovable CDN issues a new asset hash. Likely a no-op since publishing already produces a new hash.
3. Surface the publish action so you can push the current source to `app.carnivorex.app`:

   ```xml
   <presentation-actions>
     <presentation-open-publish>Republish app</presentation-open-publish>
   </presentation-actions>
   ```

4. After you republish, I'll fetch `https://app.carnivorex.app/onboarding` again and grep the new bundle to **prove** the BuildStamp string is gone. Evidence-first, as you require.

## Optional hardening (only if you want belt-and-suspenders)

Add an explicit guard in `src/main.tsx` so the `__BUILD_*` globals are dev-only and can never feed a future UI component in production:

```ts
if (import.meta.env.DEV) {
  window.__BUILD_FINGERPRINT__ = __BUILD_FINGERPRINT__ ?? "unknown";
  console.info(`[BuildInfo] fingerprint=...`);
}
```

Tell me yes/no on this and I'll include it in the same change.

## What I will NOT do

- Will not edit `App.tsx`, `Onboarding.tsx`, or any layout — there is nothing to remove there.
- Will not change the Android build, RevenueCat code, or any unrelated subsystem.
- Will not touch `src/integrations/supabase/*` or other auto-generated files.
