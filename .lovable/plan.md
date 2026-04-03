
Verified current source in `src/pages/Auth.tsx`:
- `useSearchParams` is already imported.
- The success branch already uses `navigate(returnTo, { replace: true })`.
- The remaining missing piece from your requested fix is sanitizing the query param before using it.

Plan:
1. In `src/pages/Auth.tsx`, keep the existing `useSearchParams` import.
2. Replace the current query-param setup:
```ts
const [searchParams] = useSearchParams();
const returnTo = searchParams.get("returnTo") || "/";
```
with:
```ts
const [searchParams] = useSearchParams();
const rawReturnTo = searchParams.get("returnTo") || "/";
const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";
```
3. Keep the successful login redirect as:
```ts
navigate(returnTo, { replace: true });
```
4. Do not change `App.tsx` back-button logic.

Exact target `Auth.tsx` snippet around the login success block:
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

Exact file to change:
- `src/pages/Auth.tsx`
