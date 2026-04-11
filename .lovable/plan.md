

## Fix: Push light-mode hero gradient tint lower

### Problem
The light-mode hero gradient currently holds a solid/opaque background from 0–15% and starts fading at 25%. The warm ivory tint sits too high, creating a visible "fog" band in the middle of the hero image. The text at the bottom is readable now, but the saturated tint needs to shift downward so more of the hero image is visible above.

### Change

**`src/index.css` — Light-mode `.hero-gradient` only**

Shift all intermediate stops downward so the opaque zone starts later and the tint concentrates near the bottom:

```css
:root .hero-gradient {
  background: linear-gradient(to top,
    hsl(var(--background)) 0%,
    hsl(var(--background)) 10%,
    hsl(var(--background) / 0.97) 18%,
    hsl(var(--background) / 0.75) 30%,
    hsl(var(--background) / 0.15) 50%,
    hsl(0 0% 0% / 0.15) 100%
  );
}
```

Key differences from current:
- Solid zone: 0–10% (was 0–15%)
- 0.97 stop: 18% (was 25%)
- 0.75 stop: 30% (was 40%)
- Fade-out: 0.15 at 50% (was 0.25 at 60%)

This pulls the opaque tint closer to the bottom edge, letting more hero image show through while keeping the text zone readable.

### Files changed
- `src/index.css` (light-mode `.hero-gradient` only — 1 rule, ~6 lines)

### What stays the same
- Dark mode gradient unchanged
- Text shadows on hero text unchanged
- Layout, image, colors all unchanged

