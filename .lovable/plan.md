

## Light Theme Premium Redesign

### Problem
The light mode has a muddy, washed-out hero transition where the dark athletic image fades into the light background through an ugly gray haze. The logo bar's translucent white strip blends into this haze. Feature cards lack definition. The overall feel is "faded prototype" instead of "premium wellness brand."

### Design Direction
Instead of fighting the dark hero image with weak overlays, **embrace it**: keep the hero area dark in light mode too (like premium apps such as Apple Fitness+ or Peloton), then make a clean, crisp break into the bright content area below. This gives the hero punch and makes the rest of the light UI feel intentionally bright by contrast.

---

### Changes

**1. `src/pages/Index.tsx` — Hero gradient strategy**

Replace the current gradient:
```
from-background via-background/60 to-black/30
```
With a light-mode-aware approach: keep the top of the hero dark (the image reads naturally), use a strong opaque fade at the bottom into `background`. Add a CSS class `hero-gradient` and apply different gradients per theme in CSS.

Remove the inline gradient div and replace with:
```tsx
<div className="absolute inset-0 hero-gradient" />
```

Also remove the `logo-bar-surface` wrapper around the logo — place the logo directly over the dark hero top with light text (like dark mode does). Use a new `hero-logo` class that forces light text in both themes since the hero top is always dark.

**2. `src/index.css` — Theme-aware hero + surface polish**

Add hero gradient classes:
```css
/* Light mode: hero stays dark at top, fades cleanly to light background at bottom */
:root .hero-gradient {
  background: linear-gradient(to top, 
    hsl(var(--background)) 0%, 
    hsl(var(--background)) 8%,
    hsl(var(--background) / 0.95) 15%,
    hsl(var(--background) / 0.6) 35%,
    transparent 55%,
    hsl(0 0% 0% / 0.15) 100%
  );
}

.dark .hero-gradient {
  background: linear-gradient(to top, 
    hsl(var(--background)) 0%, 
    hsl(var(--background) / 0.6) 30%,
    hsl(0 0% 0% / 0.3) 100%
  );
}
```

Force the logo and hero text to be white/light when over the hero image (light mode):
```css
:root .hero-logo .logo-wordmark {
  color: hsl(0 0% 100%);
  text-shadow: 0 1px 3px hsl(0 0% 0% / 0.3);
}

:root .hero-text-overlay {
  color: hsl(0 0% 100%);
}

:root .hero-text-overlay .text-foreground {
  color: hsl(0 0% 100%);
}

:root .hero-text-overlay .text-muted-foreground {
  color: hsl(0 0% 100% / 0.7);
}

:root .hero-text-overlay .text-primary {
  color: hsl(var(--primary));
}
```

Remove the `.logo-bar-surface` rules (no longer needed — logo sits on naturally dark hero).

Increase `.ios-card` light-mode shadow for crisper card separation:
```css
:root .ios-card {
  box-shadow: 0 1px 3px -1px hsl(20 10% 10% / 0.10), 
              0 4px 12px -4px hsl(20 10% 10% / 0.08);
  border-color: hsl(25 8% 88% / 0.8);
}
```

Bottom nav light-mode refinement:
```css
:root nav.bottom-nav {
  border-color: hsl(25 10% 88%);
  box-shadow: 0 -1px 3px hsl(20 10% 10% / 0.06);
}
```

**3. `src/components/CarnivoreXLogo.tsx` — no changes needed**

The logo already uses `logo-wordmark` class. The CSS override above will handle making it white when inside `.hero-logo`.

**4. `src/components/BottomNav.tsx` — add identifying class**

Add `bottom-nav` class to the `<nav>` element for CSS targeting. Keep existing structure.

### What stays unchanged
- Dark mode (completely untouched)
- All layout, routing, component hierarchy
- Onboarding structure
- Orange accent palette
- All app logic
- Feature card grid structure

### Files modified
1. `src/index.css` — hero gradient classes, card shadows, remove logo-bar-surface
2. `src/pages/Index.tsx` — hero gradient class, logo wrapper class, hero text wrapper class
3. `src/components/BottomNav.tsx` — add CSS class for targeting

### Result
The hero area will look dramatic and intentional in light mode (dark image, clean fade to white), the logo will be white-on-dark-image (always legible), and the content area below will be bright, crisp, and premium. Similar to how Apple Fitness+ handles light mode with dark hero imagery.

