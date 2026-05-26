/**
 * Tracks an in-flight Google OAuth flow so the deep-link handler can emit
 * `oauth:google-callback` when the carnivorex://callback intent fires.
 */
let googleInFlight = false;
let googleStartedAt = 0;

export function markGoogleOAuthInFlight() {
  googleInFlight = true;
  googleStartedAt = Date.now();
}

export function consumeGoogleOAuthInFlight(): { wasInFlight: boolean; ageMs: number } {
  const wasInFlight = googleInFlight;
  const ageMs = googleInFlight ? Date.now() - googleStartedAt : 0;
  googleInFlight = false;
  googleStartedAt = 0;
  return { wasInFlight, ageMs };
}
