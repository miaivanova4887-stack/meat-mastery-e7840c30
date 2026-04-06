

## Fix Hero Subtitle Readability

### Problem
The subtitle text ("High-protein, zero-carb fuel...") sits near the bottom of the hero where the gradient transitions from transparent to opaque background. At that position, the image is still partially visible, making white text at 85% opacity hard to read.

### Two-part fix

**1. `src/index.css` — Stronger text + darker gradient behind text zone**

- Bump `.hero-text-overlay .text-muted-foreground` from `0.85` to `0.95` opacity
- Shift the hero gradient breakpoints downward so the dark-to-opaque transition happens higher, giving the text zone more contrast:

```css
:root .hero-gradient {
  background: linear-gradient(to top,
    hsl(var(--background)) 0%,
    hsl(var(--background)) 12%,        /* was 8% — extend opaque zone */
    hsl(var(--background) / 0.95) 22%, /* was 15% — push up */
    hsl(var(--background) / 0.6) 42%,  /* was 35% — push up */
    transparent 60%,                    /* was 55% */
    hsl(0 0% 0% / 0.15) 100%
  );
}
```

This raises the "fog line" so the bottom ~22% of the hero is nearly fully opaque, placing all text on a solid-ish surface while keeping the upper hero image clean and dramatic.

**2. No JSX changes needed** — the text is already wrapped in `.hero-text-overlay`.

### Dark mode gradient stays unchanged.

### Files modified
1. `src/index.css` — 2 edits: gradient breakpoints + text opacity

