## Light Mode Premium Refinement

### Goal

Elevate the light-mode experience to feel more luxurious, intentional, and high-end — like a premium wellness app — without changing the dark mode or breaking existing functionality.

### Changes

**1. `src/index.css` — Refined light-mode design tokens and card styling**

- **Warmer, richer background**: Shift from `30 10% 98%` to `32 12% 97%` — a slightly warmer ivory with more depth
- **Subtler, warmer borders**: Shift `--border` from `25 8% 88%` to `28 10% 90%` — softer, less grey, more warm
- **Refined muted-foreground**: From `20 8% 35%` to `22 10% 40%` — warmer secondary text
- **Premium `.ios-card` in light mode**: Add a very subtle warm inner glow and refine shadow to be softer and more diffused (luxury apps use larger, lighter shadows rather than tight dark ones)
- **New utility class** `.light-divider`: A warm-toned 1px separator with gradient fade for section breaks. Do not apply this to Dark theme.
- **Section headings accent bar**: A subtle gold/primary gradient underline utility for section titles. Do not apply this to Dark theme.

**2. `src/pages/Index.tsx` — Homepage premium touches**

- **Tip card**: Replace the 💡 emoji with a styled accent icon container (small rounded primary-tinted square) for a more intentional look
- **Feature grid cards**: Add a subtle warm gradient overlay on the image portion (`from-card/0 via-card/20 to-card`) for a softer blend into the label area
- **Quote card**: Use `font-editorial` (Playfair Display) for the quote text to bring in the luxury serif accent — this is exactly the right place for it
- **Section spacing**: Increase `space-y-4` to `space-y-5` for more breathing room between sections
- **"Update preferences" link**: Style with a subtle underline and warmer color instead of plain muted text

**3. `src/components/BottomNav.tsx` — Light-mode nav refinement**

- Add a thin warm-toned top border line (1px `border-t` with warm border color) instead of relying solely on shadow
- Active tab: add a small dot indicator below the icon (2px wide, primary color) instead of just color change, for a more premium tab bar feel

**4. `src/components/MotivationCTA.tsx` — Polish the CTA card**

- In light mode, use a more defined warm background instead of `bg-card/40` — use `bg-gradient-to-br from-white to-bone` for a subtle pearl effect
- Refine the icon container shadow to be warmer-toned

### Files changed

- `src/index.css` — Token tweaks, card refinements, new utilities (~15 lines changed/added)
- `src/pages/Index.tsx` — Quote font, tip icon, spacing, feature card overlay (~10 lines)
- `src/components/BottomNav.tsx` — Active dot indicator, border (~5 lines)
- `src/components/MotivationCTA.tsx` — Light-mode background refinement (~3 lines)

### What stays the same

- Dark mode completely untouched
- Layout structure, hero image, navigation routes
- All other pages unaffected
- Brand colors (flame, gold, primary) preserved