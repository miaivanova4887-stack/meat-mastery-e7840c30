/**
 * Biometric Auth Abstraction
 *
 * IMPORTANT — Privacy & Policy:
 * - This module is a placeholder for DEVICE-NATIVE biometric unlock only.
 * - CarnivoreX does NOT collect, store, or transmit any biometric data.
 * - Biometric verification (Face ID / Touch ID / Android Biometric) happens
 *   locally on the device via the OS. The app only receives a yes/no result.
 *
 * To enable in the future:
 * 1. Install a Capacitor biometric plugin (e.g. `capacitor-native-biometric`).
 * 2. Replace stubs with real plugin calls (NativeBiometric.isAvailable / verifyIdentity).
 * 3. Store any required credential (e.g. a Supabase refresh token) ONLY in the
 *    secure native keychain via `NativeBiometric.setCredentials` — never in
 *    browser localStorage.
 * 4. On successful biometric verification, restore the Supabase session via
 *    `supabase.auth.setSession({ refresh_token, access_token: "" })`.
 * 5. Flip `BIOMETRIC_FEATURE_ENABLED` to true.
 */

export const BIOMETRIC_FEATURE_ENABLED = false;

export async function isBiometricSupported(): Promise<boolean> {
  if (!BIOMETRIC_FEATURE_ENABLED) return false;
  // TODO: when plugin installed, call NativeBiometric.isAvailable()
  return false;
}

export function rememberBiometricEmail(_email: string): void {
  // Placeholder. Future implementation should persist a non-secret
  // identifier (such as the user's email) so we can show the biometric
  // button only for accounts that have previously authenticated on this
  // device. Secrets must NEVER be stored here.
}

export function getRememberedBiometricEmail(): string | null {
  return null;
}

export function clearBiometricEmail(): void {
  // Placeholder
}

export async function authenticateWithBiometrics(): Promise<{ ok: boolean; error?: string }> {
  if (!BIOMETRIC_FEATURE_ENABLED) {
    return { ok: false, error: "Biometrics not enabled" };
  }
  // TODO: NativeBiometric.verifyIdentity(...) + restore Supabase session
  // from refresh token retrieved via NativeBiometric.getCredentials.
  return { ok: false, error: "Not implemented yet" };
}
