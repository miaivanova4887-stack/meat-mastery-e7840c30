

## Replace CmsEditor Admin Guard with Local State Machine

### What changes
Replace the `useIsAdmin` hook + redirect pattern with a self-contained `adminStatus` state machine (`'checking' | 'admin' | 'denied'`). No navigation — just conditional rendering.

### Change — `src/pages/CmsEditor.tsx`

**Imports:**
- Remove `useIsAdmin` import
- Remove `useNavigate` import
- Remove `Loader2`, `ShieldAlert` from lucide imports (no longer used in same way)
- Add `supabase` import from `@/integrations/supabase/client`

**Component body:**
- Remove `const navigate = useNavigate()`
- Remove `const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id)`
- Add `const [adminStatus, setAdminStatus] = useState<'checking' | 'admin' | 'denied'>('checking')`
- Replace the existing `useEffect` + redirect with:
  ```tsx
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminStatus('denied'); return; }
    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin")
        .maybeSingle();
      setAdminStatus(!!data && !error ? 'admin' : 'denied');
    };
    checkAdmin();
  }, [user, authLoading]);
  ```
- Replace loading guard: show spinner when `adminStatus === 'checking'`
- Replace denied guard: show "Access denied." text when `adminStatus === 'denied'`
- Keep the existing `console.log` debug line, updated to reflect new variables
- Keep `activeTab` state and entire CMS tab UI unchanged — only renders when `adminStatus === 'admin'`
- Keep the "← Back to App" button (it uses `navigate`, so keep `useNavigate` for that one usage)

### Files modified
- `src/pages/CmsEditor.tsx` — replace admin guard logic

