
Goal: make the coaching login redirect durable in the APK using the `returnTo` query-param flow, without touching `App.tsx` back-button logic or unrelated auth redirects.

What I verified in the current repo
- `src/pages/Auth.tsx` already imports `useSearchParams`, sanitizes `returnTo`, and the login success branch currently uses `navigate(returnTo, { replace: true })`.
- `src/pages/Coaching.tsx` already redirects unauthenticated coaching users to `/auth?returnTo=...` in both the paid-booking check and the sign-in CTA.
- `src/components/CoachingBooking.tsx` already uses the same query-param redirect pattern for the coaching modal flow.
- No `navigate("/")` remains in the current `Auth.tsx` login success flow.

Implementation plan
1. Keep the current `Auth.tsx` query-param redirect pattern as the source of truth:
   - `useSearchParams`
   - `rawReturnTo`
   - sanitized `returnTo`
   - `navigate(returnTo, { replace: true })` on successful login
2. Keep coaching redirects URL-based only:
   - `src/pages/Coaching.tsx`
   - `src/components/CoachingBooking.tsx`
3. Preserve the most specific coaching destination:
   - keep the current exact-location form (`location.pathname + location.search + location.hash`) rather than downgrading to hardcoded `"/coaching"`, because it restores the full coaching URL if search/hash is present
4. Do not modify `App.tsx` or unrelated `/auth` redirects elsewhere yet.
5. On delivery, provide:
   - the exact `Auth.tsx` snippet around `searchParams` setup and login success redirect
   - the exact `Coaching.tsx` sign-in button snippet
   - confirmation that no `navigate("/")` remains in the `Auth.tsx` login success flow

Files in scope
- `src/pages/Auth.tsx`
- `src/pages/Coaching.tsx`
- `src/components/CoachingBooking.tsx`

Verified current snippets to preserve/normalize

`src/pages/Auth.tsx`
```tsx
const navigate = useNavigate();
const [searchParams] = useSearchParams();
const rawReturnTo = searchParams.get("returnTo") || "/";
const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";
const { signIn, signUp } = useAuth();
const { t } = useTranslation();

...

    } else if (mode === "signup") {
      toast.success(t("auth.checkEmail"));
    } else {
      toast.success(t("auth.welcomeBackToast"));
      navigate(returnTo, { replace: true });
    }
```

`src/pages/Coaching.tsx`
```tsx
<Button
  className="w-full gap-2 mt-2"
  onClick={() =>
    navigate(
      `/auth?returnTo=${encodeURIComponent(
        location.pathname + location.search + location.hash
      )}`
    )
  }
>
  <LogIn size={14} />
  Sign In / Create Account
</Button>
```
