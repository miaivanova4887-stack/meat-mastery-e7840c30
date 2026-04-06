

## Light Theme Contrast & Polish Pass

Four files, theme-only changes. Dark mode and all layout/logic untouched.

---

### 1. `src/index.css` — Clean up light `:root` variables

Replace the dusty beige palette with a cleaner warm ivory:

| Variable | Current | New |
|---|---|---|
| `--background` | `30 15% 95%` | `30 10% 98%` |
| `--foreground` | `20 10% 8%` | `20 15% 5%` |
| `--card` | `30 20% 99%` | `0 0% 100%` |
| `--card-foreground` | `20 10% 8%` | `20 15% 5%` |
| `--popover` | `30 20% 99%` | `0 0% 100%` |
| `--popover-foreground` | `20 10% 8%` | `20 15% 5%` |
| `--secondary` | `25 12% 92%` | `25 8% 94%` |
| `--muted` | `25 10% 93%` | `25 6% 94%` |
| `--muted-foreground` | `20 5% 40%` | `20 8% 35%` |
| `--border` | `25 10% 86%` | `25 8% 88%` |
| `--input` | `25 10% 88%` | `25 6% 90%` |
| `--smoke` | `20 5% 50%` | `20 8% 38%` |
| `--bone` | `30 20% 96%` | `30 10% 97%` |
| `--sidebar-background` | `30 15% 95%` | `30 10% 98%` |
| `--sidebar-foreground` | `20 10% 8%` | `20 15% 5%` |
| `--sidebar` | `30 20% 99%` | `0 0% 100%` |

Bump light-mode shadow opacities up ~2% each (e.g. `0.04` → `0.06`, `0.08` → `0.10`) for crisper card definition. Update the light `.ios-card` shadow similarly.

### 2. `src/components/CarnivoreXLogo.tsx`

Change the parent `<span>` from `font-semibold` to `font-bold`. No other changes.

### 3. `src/components/BottomNav.tsx`

- `bg-card/90` → `bg-card/95`
- `border-border/30` → `border-border/50`

### 4. `src/pages/Index.tsx` — line 131

Change hero gradient from:
```
from-background via-background/70 to-black/40
```
to:
```
from-background via-background/60 to-black/30
```

