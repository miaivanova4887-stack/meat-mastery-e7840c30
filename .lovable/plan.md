

## Fix: Push light-mode hero gradient tint even lower

### Change

**`src/index.css` — `:root .hero-gradient` only**

Shift stops downward again so the opaque tint hugs the very bottom:

```css
:root .hero-gradient {
  background: linear-gradient(to top,
    hsl(var(--background)) 0%,
    hsl(var(--background)) 8%,
    hsl(var(--background) / 0.95) 14%,
    hsl(var(--background) / 0.6) 24%,
    hsl(var(--background) / 0.1) 42%,
    hsl(0 0% 0% / 0.15) 100%
  );
}
```

Key differences from current:
- Solid zone: 0–8% (was 0–10%)
- 0.95 stop: 14% (was 0.97 at 18%)
- 0.6 stop: 24% (was 0.75 at 30%)
- Fade-out: 0.1 at 42% (was 0.15 at 50%)

This pulls the visible tint closer to the bottom edge, letting more hero image show through. Dark mode unchanged.

### Files changed
- `src/index.css` (1 rule, ~6 lines)

