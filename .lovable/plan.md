

## Create `useIsAdmin` Hook & Update CMS Editor Guard

### Change 1 — New file: `src/hooks/useIsAdmin.ts`

Create the hook exactly as provided by the user, with the synchronous `prevUserIdRef` reset pattern to prevent premature redirects during render.

### Change 2 — Update `src/pages/CmsEditor.tsx`

- Remove inline admin-check `useEffect` and `useState<boolean | null>` for `isAdmin`
- Import and use `useIsAdmin(user?.id)` instead
- Replace the redirect `useEffect` with the guarded version that waits for both `authLoading` and `roleLoading`
- Remove the `supabase` import (no longer needed in this file)
- Keep the loading spinner for `authLoading || roleLoading`
- Keep the "Admin Access Required" fallback for `!isAdmin` after loading completes

### Files modified
- `src/hooks/useIsAdmin.ts` — new file
- `src/pages/CmsEditor.tsx` — refactored guard logic

