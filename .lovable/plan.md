# Regenerate App Store Subscription Promo Images

Apple rejected the existing Pro Yearly image. Root cause: prior images used busy backgrounds and stylized "PRO YEARLY" lockups that read as marketing/ad creative. Apple wants the 1024×1024 subscription image to clearly identify the product to App Review with minimal, readable, on-brand styling.

## Deliverables

Four PNG files, 1024×1024, English only, ready to upload to App Store Connect:

| File | Tier name (large) | Benefit line (smaller) | Accent |
|------|--------------------|------------------------|--------|
| `pro-monthly.png` | Pro Monthly | Premium coaching & meal plans | CarnivoreX red |
| `pro-annual.png`  | Pro Annual  | Premium coaching & meal plans | CarnivoreX red |
| `elite-monthly.png` | Elite Monthly | Everything in Pro + 1-on-1 expert sessions | Gold |
| `elite-annual.png`  | Elite Annual  | Everything in Pro + 1-on-1 expert sessions | Gold |

All four share the exact same layout — only the tier name, benefit line, and accent color change. This gives App Review a consistent, easy-to-distinguish set.

## Visual spec

```text
┌──────────────────────────────────────┐
│                                      │
│            CARNIVOREX                │   ← small wordmark, top, letterspaced
│                                      │
│                                      │
│          ┌─────────────┐             │
│          │  PRO MONTHLY│             │   ← huge bold sans (Inter/SF-style)
│          └─────────────┘             │      red or gold accent underline
│                                      │
│   Premium coaching & meal plans      │   ← one short benefit line, lighter
│                                      │
│                                      │
└──────────────────────────────────────┘
```

- Background: deep charcoal/onyx (`#0B0B0C` → `#15151A` radial), subtle vignette, no photography, no food, no UI screenshots.
- Tier name: bold, extra-large, white, centered, single line.
- Thin 2px accent rule beneath the tier name: red `#E03A2F` (Pro) or warm gold `#C9A84C` (Elite).
- Benefit line: regular weight, ~38–44px, light gray `#C8C8CC`, single line.
- Small `CARNIVOREX` wordmark at top, letter-spaced, muted.
- No prices, no "$", no "/mo", no badges, no decorations beyond the accent rule.

## Generation approach

Use the agent `generate_image` tool at premium tier (text legibility matters). Generate 1024×1024 PNGs directly to `/mnt/documents/app-store/`:

- `/mnt/documents/app-store/pro-monthly.png`
- `/mnt/documents/app-store/pro-annual.png`
- `/mnt/documents/app-store/elite-monthly.png`
- `/mnt/documents/app-store/elite-annual.png`

Each prompt locks the same composition, palette, and typography description, varying only the tier line + benefit + accent color, so the four images sit together as a clean family.

## QA before delivery

After generation, inspect each PNG visually and confirm:
1. Tier name and benefit line are crisp, correctly spelled, no AI typography glitches.
2. No stray badges, prices, or extra words.
3. Dimensions exactly 1024×1024.
4. Background is clean dark, no food/photography artifacts.

If any image fails QA, regenerate just that one with a tightened prompt.

## Delivery

Surface all 4 as downloadable artifacts:

```
<presentation-artifact path="app-store/pro-monthly.png" mime_type="image/png"></presentation-artifact>
<presentation-artifact path="app-store/pro-annual.png" mime_type="image/png"></presentation-artifact>
<presentation-artifact path="app-store/elite-monthly.png" mime_type="image/png"></presentation-artifact>
<presentation-artifact path="app-store/elite-annual.png" mime_type="image/png"></presentation-artifact>
```

Then give you the App Store Connect upload steps line-by-line (Subscriptions → each product → Promotional Image → Choose File → upload → Save).

## Out of scope

- No code changes. These are App Store Connect assets only, not in-app images.
- No Coaching Call consumable image (per your scope answer).
- No FR locale images.
