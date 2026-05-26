/**
 * Production-visible build identifier.
 *
 * The ONLY source of truth for which auth-flow JS bundle is actually
 * running on device. Bumped intentionally each time we ship proof or fix
 * code for the OAuth deep-link loop so logs/UI prove which bundle is live.
 */
export const AUTH_FLOW_BUILD = "v11-20260526-proof-path";
