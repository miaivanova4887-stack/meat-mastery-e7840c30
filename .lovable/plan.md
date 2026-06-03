# Font Size & Screen Scaling Audit

## Audit results (pass / fail)


| #   | Area                                | Status           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dynamic Type / viewport / Capacitor | **PASS**         | `index.html` viewport is `width=device-width, initial-scale=1.0, viewport-fit=cover` — no `user-scalable=no`, no `maximum-scale=1` (intentional comment present). `capacitor.config.json` has no font-suppressing keys. `ios/App/App/Info.plist` has no font-scale-blocking keys. **Caveat:** iOS WKWebView does NOT propagate Dynamic Type into HTML automatically — it only does so for elements styled with `font: -apple-system-body`. Pure rem text scales with the WebView's own size (`-webkit-text-size-adjust`), which we already enable, but it does **not** track Settings → Larger Text. This is a WebKit limitation, not an app bug, and Apple does not reject Capacitor apps for it. |
| 2   | CSS font sizing                     | **PARTIAL FAIL** | Root `html` uses a `clamp()` tied to `vw` (good for device-width scaling, not Dynamic Type). 180+ components use arbitrary `text-[Npx]` classes (`text-[9px]` … `text-[15px]`, `text-[26px]`). These are remapped in `src/index.css` to **fixed pixel** sizes per viewport breakpoint — so they scale with screen width but **never with user font preference**. Tailwind tokens (`text-xs`/`sm`/`base`/`lg`) are used inconsistently.                                                                                                                                                                                                                                                             |
| 3   | Minimum font sizes                  | **FAIL**         | `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]` render below 12px on iPhone SE / 360px Androids (Tier-1 leaves `text-[8px]`=10px, `text-[9px]`=11px, `text-[10px]`=12px, `text-[11px]`=13px — only border-acceptable; below 375px width nothing is remapped at all so `text-[8px]`=8px literally).                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | Layout reflow at large text         | **PARTIAL FAIL** | Fixed `h-10`/`h-12`/`h-14` containers in headers, list rows, badges and meal-plan grids will clip when text grows. Bottom-nav, sticky page headers, and KetosisTimer phase chips are the highest-risk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5   | Inputs ≥ 16px (iOS auto-zoom)       | **MIXED**        | `src/components/ui/input.tsx` uses `text-base` on mobile + `md:text-sm` — correct (16px on phones). `src/components/ui/textarea.tsx` uses `text-sm` unconditionally → **14px, will trigger iOS focus zoom**. Custom `<input>`/`<textarea>` outside the shadcn primitives need spot-check (Onboarding, CreatePostSheet, AdminNotifications).                                                                                                                                                                                                                                                                                                                                                        |


## What to change

### Phase 1 — Foundational fixes (small, safe, high impact)

1. `**src/components/ui/textarea.tsx**` — change `text-sm` → `text-base md:text-sm` (matches Input pattern). Prevents iOS focus-zoom on every textarea in the app.
2. `**src/index.css` Tier-0 (default, < 375px) safety floor** — add a `@layer base` block that maps `.text-[8px]` / `.text-[9px]` / `.text-[10px]` / `.text-[11px]` to a minimum of 12px so iPhone SE never renders below the 12px floor.
3. **Convert the px-override blocks to use `rem**` — rewrite the five tier blocks in `src/index.css` so each `text-[Npx]` resolves to a rem value (e.g. `text-[12px] → 0.875rem` on the base tier, scaling up by tier). This lets the device-width `clamp()` on `html { font-size }` flow through to every text class, and means any future per-user font preference (browser zoom, Android system font scale, OS accessibility text-size adjust on Android WebView) actually takes effect. Dark/light theme and visual layout are unaffected — the produced sizes match the current Tier-1 → Tier-5 ladder in rem.
4. **Re-confirm viewport meta** — leave `index.html` exactly as-is (already correct). Audit deliverable will explicitly state "`maximum-scale` and `user-scalable=no` are NOT present".

### Phase 2 — Source-level text token migration (separate follow-up, not in this plan)

The ~180 `text-[Npx]` occurrences across 30+ files should eventually move to Tailwind semantic tokens (`text-xs`, `text-sm`, `text-base`, `text-lg`) so the design system is enforced at the source. Phase 1 makes this non-urgent because the CSS remap already neutralises the worst behaviour. Call this out in the deliverable as a tracked debt item but do **not** touch component source in this pass — it would be a multi-thousand-line diff with high regression risk for a cosmetic refactor.

### Phase 3 — Fixed-height containers

Audit `h-10`/`h-12`/`h-14` on text-bearing rows and convert to `min-h-*`. Highest priority files (from grep):

- `src/components/BottomNav.tsx` — labels under icons
- `src/components/cms/*` toolbars (admin only, lower priority)
- `src/pages/KetosisTimer.tsx` phase chips (lines ~317-362)
- `src/pages/MealPlan.tsx` day chips and meal-row badges
- `src/pages/Profile.tsx` stat rows (lines ~690-810)

For Phase 3, I will change only containers that visibly clip when zoomed to 200% in the browser preview at 390×823, to avoid breaking the design system spacing.

## Files touched in Phase 1

- `src/index.css` — add Tier-0 floor block; rewrite Tier-1 … Tier-5 override blocks to use rem.
- `src/components/ui/textarea.tsx` — one className change.

## Verification

1. Open DevTools → set viewport 320×568 (SE) → confirm no text renders below 12px.
2. Open viewport 402×844 → confirm body text visually matches current build (no regressions).
3. Focus a `<Textarea>` on iOS simulator (or browser-emulated mobile) → confirm no zoom.
4. Toggle browser zoom 200% → confirm `text-[Npx]` text grows proportionally (it will not in current build).
5. Grep `index.html` confirms `user-scalable` and `maximum-scale` absent.

## **One addition worth flagging**

`-webkit-text-size-adjust: 100%` **on the html element** — confirm this is set in `src/index.css` or a global base style. Without it, some browsers and Android WebViews apply their own automatic text inflation on small viewports, which can make text randomly larger than intended on non-iOS devices. Lovable's audit mentions `-webkit-text-size-adjust` is already enabled — just confirm it is set to `100%` and not `none`, since `none` would block ALL scaling including browser zoom accessibility.

## **One gap in Phase 3 scope**

The plan says fixed-height containers will only be fixed "where clipping is visible at 200% zoom." That is a reasonable constraint, but make sure `BottomNav.tsx` is treated as **mandatory** regardless — bottom navigation labels are used on every screen and are the highest visibility clipping risk for App Review, which commonly checks accessibility zoom.

## **Verification step to add**

After Phase 1 is applied, add one extra check: open the app in Chrome DevTools, set the viewport to **320×568** (iPhone SE size), open the computed styles panel, and confirm no rendered font size is below **12px** — this is a direct verification of the Tier-0 floor fix.

## Out of scope (explicit)

- Migrating all `text-[Npx]` to Tailwind tokens at the call site (Phase 2 — tracked, not done).
- Restyling fixed-height layouts beyond the few highest-risk areas (Phase 3 — done only where clipping is visible).
- Any change to dark theme, light theme palette, or the `clamp()` device-width formula.
- iOS Dynamic Type ↔ WKWebView bridging (WebKit limitation, not actionable in app code).