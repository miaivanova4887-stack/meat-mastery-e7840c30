// Shared safe-origin resolver for Stripe redirect URLs.
// Prevents open-redirect via a forged Origin header.

const ALLOWED_ORIGINS = new Set<string>([
  "https://app.carnivorex.app",
  "https://carnivorex.app",
  "https://carnivore-coach-pro.lovable.app",
  "https://id-preview--8cc44691-15e2-40ab-844f-f90c5fa95cc6.lovable.app",
  "https://8cc44691-15e2-40ab-844f-f90c5fa95cc6.lovableproject.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  // Capacitor in-app browser origins
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);

const DEFAULT_ORIGIN = "https://app.carnivorex.app";

export function safeOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Allow any *.lovable.app preview subdomain (sandbox previews).
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && /\.lovable\.app$/.test(u.hostname)) {
      return origin;
    }
  } catch { /* ignore */ }
  return DEFAULT_ORIGIN;
}
