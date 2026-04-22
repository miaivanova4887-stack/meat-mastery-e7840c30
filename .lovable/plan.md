## Add Forgot Password + Biometric Sign-In to Auth flow

### Part 1 — Forgot Password (fully functional)

`**src/contexts/AuthContext.tsx**` — add a `resetPassword` method:

```ts
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error: error?.message ?? null };
};
```

Expose it via the context value and `AuthContextType`.

`**src/pages/Auth.tsx**` — add a third mode `"forgot"`:

- Add a `Forgot password?` link **below the password input, above the Sign In button**, right-aligned, only shown when `mode === "login"`. Style: `text-xs text-primary/80 self-end`.
- Tapping it switches `mode` to `"forgot"`, hiding the password field and submit reverting to a single email input + "Send reset link" button.
- Submitting calls `resetPassword(email)` and shows toasts:
  - Success → `"Password reset email sent. Check your inbox."`
  - Error (no account / generic) → map common Supabase errors:
    - `user not found` → `"We couldn't find an account with that email."`
    - else → raw message
- Below the form, replace the Sign Up toggle text with a "Back to Sign In" link when in forgot mode.
- Header title becomes `"Reset Password"` in forgot mode.

**New page `src/pages/ResetPassword.tsx**` — public route that lets the user set a new password after clicking the email link:

- Reads recovery state from Supabase's auto-detected hash (no manual parsing — Supabase v2 handles it via `onAuthStateChange` `PASSWORD_RECOVERY` event).
- Shows `New password` + `Confirm password` fields, calls `supabase.auth.updateUser({ password })`.
- Success → toast `"Password updated."` and `navigate("/", { replace: true })`.
- Error → toast the error message.
- Same dark premium styling as `Auth.tsx` (sticky header, `inputClass`, primary button).

`**src/App.tsx**` — register `<Route path="/reset-password" element={<ResetPassword />} />`.

`**src/i18n/en.json` + `src/i18n/fr.json**` — add `auth.forgotPassword`, `auth.sendResetLink`, `auth.resetSent`, `auth.noAccountFound`, `auth.backToSignIn`, `auth.resetTitle`, `auth.newPassword`, `auth.confirmPassword`, `auth.passwordsDontMatch`, `auth.passwordUpdated`.

### Part 2 — Biometric Sign-In (UI + safe stub, behind a feature flag)

The current Capacitor stack does **not** include `@capacitor-community/biometric-auth` or `capacitor-native-biometric`. Per the requirement, we add the UI, storage shape, and a clean abstraction now without breaking the build, and gate it behind a feature flag so installing the plugin later flips it on.

**New file `src/lib/biometricAuth.ts**` — small abstraction with a feature flag:

```ts
export const BIOMETRIC_FEATURE_ENABLED = false; // flip to true when plugin is installed
const CRED_KEY = "biometric_email_v1";

export async function isBiometricSupported(): Promise<boolean> {
  if (!BIOMETRIC_FEATURE_ENABLED) return false;
  // TODO: when plugin installed, call NativeBiometric.isAvailable()
  return false;
}
export function rememberBiometricEmail(email: string) {
  localStorage.setItem(CRED_KEY, email);
}
export function getRememberedBiometricEmail(): string | null {
  return localStorage.getItem(CRED_KEY);
}
export function clearBiometricEmail() {
  localStorage.removeItem(CRED_KEY);
}
export async function authenticateWithBiometrics(): Promise<{ ok: boolean; error?: string }> {
  if (!BIOMETRIC_FEATURE_ENABLED) return { ok: false, error: "Biometrics not enabled" };
  // TODO: NativeBiometric.verifyIdentity(...) + retrieve stored Supabase refresh token
  return { ok: false, error: "Not implemented yet" };
}
```

Notes recorded in the file: when ready, install `capacitor-native-biometric`, store the Supabase **refresh token** in the secure keychain via `NativeBiometric.setCredentials`, and on success call `supabase.auth.setSession({ refresh_token, access_token: "" })`.

`**src/pages/Auth.tsx**` — biometric UI behind support check:

- After a successful sign-in (login mode only), call `rememberBiometricEmail(email)` so we know this device has been used by this account.
- On mount, run `const [bioReady, setBioReady] = useState(false)` and `useEffect(() => { isBiometricSupported().then(s => setBioReady(s && !!getRememberedBiometricEmail())); }, [])`.
- When `bioReady && mode === "login"`, render a secondary button **above** Sign In:
  - Icon: `Fingerprint` from `lucide-react`
  - Label: `"Sign in with Face ID / Touch ID"` (single i18n key `auth.signInWithBiometrics`)
  - On tap → `authenticateWithBiometrics()`. On `ok`, navigate to `returnTo`. On error, toast.
- Because `BIOMETRIC_FEATURE_ENABLED = false` for now, the button never appears in production, so the existing login flow is unchanged. UI is in place and ready.

### Part 3 — Acceptance criteria check

- Forgot Password link sits below password / above Sign In button, right-aligned, login mode only.
- Tapping it opens the email-only reset flow on the **same screen** (no new route for the request step).
- Reset email sends via Supabase, redirecting users to the new `/reset-password` page where they set a new password.
- Toasts: `"Password reset email sent. Check your inbox."` and `"We couldn't find an account with that email."`.
- Sign In and Sign Up flows are otherwise unchanged.
- Biometric button is fully wired but hidden until the feature flag is enabled — existing login is not affected.

### Files changed

1. `src/contexts/AuthContext.tsx` — add `resetPassword`
2. `src/pages/Auth.tsx` — forgot-password mode, link, biometric button (gated), success/error toasts
3. `src/pages/ResetPassword.tsx` — **new** page for setting a new password
4. `src/App.tsx` — register `/reset-password` route
5. `src/lib/biometricAuth.ts` — **new** abstraction + feature flag + TODOs
6. `src/i18n/en.json`, `src/i18n/fr.json` — new auth strings

### What stays the same

- Existing Sign In / Sign Up logic, toasts, and styling
- Header layout, input styling (`inputClass`), primary button styling
- AuthContext signature for `signIn`, `signUp`, `signOut`
- No new dependencies installed (biometrics is a stubbed feature flag)

&nbsp;

Add **Forgot Password** and **device-native biometric unlock** to the CarnivoreX auth flow.

## **Part 1 — Forgot Password**

Implement a fully functional password reset flow using Supabase.

## `src/contexts/AuthContext.tsx`

Add a `resetPassword(email: string)` method that calls:

```
ts
```

`const { error } = await supabase.auth.resetPasswordForEmail(email, {`  
  `redirectTo: ${window.location.origin}/reset-password,`  
`});`  
`return { error: error?.message ?? null };`

Expose it in `AuthContextType` and the context value.

## `src/pages/Auth.tsx`

Add a third mode: `"forgot"`.

Behavior:

- Show a **“Forgot password?”** link below the password input and above the Sign In button, only in login mode.
- Right-align it and style it subtly with the current auth design.
- Tapping it switches to forgot-password mode on the same screen.
- In forgot mode, hide the password field and show:
  - one email field,
  - a **“Send reset link”** button,
  - a **“Back to Sign In”** link below the form.
- Change the header title to **“Reset Password”** in forgot mode.
- On submit, call `resetPassword(email)` and show toasts:
  - Success: **“Password reset email sent. Check your inbox.”**
  - Error mapping:
    - `user not found` → **“We couldn't find an account with that email.”**
    - otherwise show the raw message.

## `src/pages/ResetPassword.tsx`

Create a new public route page for users who click the reset link.

Behavior:

- Listen for Supabase recovery state using `onAuthStateChange` and the `PASSWORD_RECOVERY` event.
- Show:
  - **New password**
  - **Confirm password**
- Validate matching passwords.
- Call `supabase.auth.updateUser({ password })` to complete the reset.
- On success:
  - toast **“Password updated.”**
  - `navigate("/", { replace: true })`
- On error:
  - toast the error message
- Match the same dark premium auth styling as `Auth.tsx`.

## `src/App.tsx`

Register:

```
tsx
```

`<Route path="/reset-password" element={<ResetPassword />} />`

## `src/i18n/en.json` **and** `src/i18n/fr.json`

Add:

- `auth.forgotPassword`
- `auth.sendResetLink`
- `auth.resetSent`
- `auth.noAccountFound`
- `auth.backToSignIn`
- `auth.resetTitle`
- `auth.newPassword`
- `auth.confirmPassword`
- `auth.passwordsDontMatch`
- `auth.passwordUpdated`

## **Part 2 — Device-native biometric unlock**

Add biometric sign-in as **device-native unlock only**.

Important:

- The app must **never collect, store, or transmit biometric data**.
- Biometrics must use the OS-native Face ID / Touch ID / Android biometric system only.
- This feature is optional and only for returning users who have already signed in once.
- Keep password sign-in as the primary method.

## **New file:** `src/lib/biometricAuth.ts`

Create a clean abstraction with a feature flag:

```
ts
```

`export const BIOMETRIC_FEATURE_ENABLED = false;`  
  
`export async function isBiometricSupported(): Promise<boolean> {`  
  `if (!BIOMETRIC_FEATURE_ENABLED) return false;`  
  `return false;`  
`}`  
  
`export function rememberBiometricEmail(email: string) {`  
  `// optional placeholder for future secure-native implementation`  
`}`  
  
`export function getRememberedBiometricEmail(): string | null {`  
  `return null;`  
`}`  
  
`export function clearBiometricEmail() {`  
  `// placeholder`  
`}`  
  
`export async function authenticateWithBiometrics(): Promise<{ ok: boolean; error?: string }> {`  
  `if (!BIOMETRIC_FEATURE_ENABLED) return { ok: false, error: "Biometrics not enabled" };`  
  `return { ok: false, error: "Not implemented yet" };`  
`}`

Add comments noting:

- when ready, install a native biometric plugin,
- store any required refresh token only in secure native storage,
- do **not** use browser `localStorage` for secrets,
- biometric verification must happen locally on-device.

## `src/pages/Auth.tsx`

Add the biometric UI behind support checks and the feature flag.

Behavior:

- After a successful login, if mode is login, record that this account has used biometrics on this device.
- On mount, check whether biometrics are supported and whether this device/account has been used before.
- If supported and enabled, render a secondary button above Sign In:
  - icon: `Fingerprint` from `lucide-react`
  - label: **“Sign in with Face ID / Touch ID”**
- On tap, call `authenticateWithBiometrics()`.
- On success, navigate to `returnTo`.
- On error, show a toast.

Because `BIOMETRIC_FEATURE_ENABLED = false`, this button remains hidden in production until the native plugin is actually added.

## **Part 3 — Acceptance criteria**

- Forgot Password link appears below password and above Sign In in login mode only.
- Reset request happens on the same screen.
- Reset email redirects to `/reset-password`.
- New password page works end-to-end with Supabase.
- Biometric unlock is device-native only.
- No biometric data is collected, stored, or transmitted by CarnivoreX.
- Existing sign-in/sign-up behavior remains unchanged.

## **Files changed**

1. `src/contexts/AuthContext.tsx`
2. `src/pages/Auth.tsx`
3. `src/pages/ResetPassword.tsx`
4. `src/App.tsx`
5. `src/lib/biometricAuth.ts`
6. `src/i18n/en.json`
7. `src/i18n/fr.json`

## **What stays the same**

- Current auth styling
- Existing sign-in/sign-up logic
- Primary button and input classes
- Dark premium design
- No new dependencies installed yet

## **Policy note**

Biometric unlock is **device-native only**, so CarnivoreX does not collect biometric data. That means no major Terms of Service change is needed, and the Privacy Policy only needs a brief disclosure if you want explicit transparency about optional biometric unlock.

If you want, I can also turn this into a **shorter Lovable prompt** that’s optimized for direct paste-in.