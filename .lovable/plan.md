

## Add Debug Toasts to Auth Success Branches

### Change: `src/pages/Auth.tsx` lines 54–59

Replace:
```tsx
    } else if (mode === "signup") {
      toast.success(t("auth.checkEmail"));
    } else {
      toast.success(t("auth.welcomeBackToast"));
      navigate(returnTo, { replace: true });
    }
```

With:
```tsx
    } else if (mode === "signup") {
      toast.success(t("auth.checkEmail"));
      toast.success(`DEBUG signup returnTo=${returnTo} href=${window.location.href}`);
    } else {
      toast.success(t("auth.welcomeBackToast"));
      toast.success(`DEBUG login returnTo=${returnTo} href=${window.location.href}`);
      navigate(returnTo, { replace: true });
    }
```

**Nothing else changes.** All imports, sanitization logic, and navigation remain intact. `App.tsx` untouched.

