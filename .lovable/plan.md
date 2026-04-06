

## Remove Bottom Nav Top Border

**File:** `src/components/BottomNav.tsx` (line 22)

Remove `border-t border-border/50` entirely from the nav className. The `dark:border-transparent` can also go since there's no border to override. The `ios-blur` backdrop and `shadow-lg` already provide visual separation.

Change:
```
border-t border-border/50 dark:border-transparent
```
To: remove all three classes.

The light-mode CSS rule (`:root nav.bottom-nav`) that styles the border will also have no effect since there's no `border-t` utility class to create the border in the first place.

**One file, one line edit. No layout or structural changes.**

