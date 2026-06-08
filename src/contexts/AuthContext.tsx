import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

import { getLocalPushConsent } from "@/lib/pushConsentLocal";
import { reconcileCachedAppleName } from "@/lib/appleDisplayName";
import { logAfEvent, setAppsFlyerUserId, AF_EVENTS, AF_PARAMS } from "@/lib/appsflyer";

/** Where verification / recovery emails should send users back to.
 * Always app.carnivorex.app so the link works for both the installed
 * Android app (via App Links) and the published web app. The bare
 * lovable.app preview origin is intentionally NOT used because the
 * marketing site sits on the root carnivorex.app domain and we keep
 * a single canonical auth-callback host. */
function resolveAuthRedirect(path: "/auth/callback" | "/reset-password"): string {
  return `https://app.carnivorex.app${path}`;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ONBOARDING_COMPLETE_KEY = "carnivore-onboarding-complete-v3";
const RECONCILE_RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Reconcile the anonymous local push-consent marker into the user's
 * profile row. Retries a few times because handle_new_user() inserts
 * the profile asynchronously after sign-up; if the row isn't there yet
 * we wait and try again rather than dropping the local consent.
 */
async function reconcileLocalConsent(userId: string, attempt = 0): Promise<void> {
  const local = getLocalPushConsent();
  // Always log the onboarding flag presence so logcat confirms continuity.
  if (attempt === 0) {
    try {
      const onb = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
      console.info("[Onboarding] local flag carried into session present=", onb);
    } catch {}
  }
  if (local === "unset") {
    console.info("[Push] reconcile skipped reason=local-unset");
    return;
  }
  try {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("push_consent")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      if (attempt < RECONCILE_RETRY_DELAYS_MS.length) {
        const delay = RECONCILE_RETRY_DELAYS_MS[attempt];
        console.info("[Push] reconcile waiting for profile attempt=", attempt, "delayMs=", delay);
        setTimeout(() => { void reconcileLocalConsent(userId, attempt + 1); }, delay);
      } else {
        console.warn("[Push] reconcile gave up after retries error=", error);
      }
      return;
    }
    const remote = data.push_consent ?? "unset";
    if (remote !== "unset") {
      console.info("[Push] reconcile skipped reason=remote-already-set remote=", remote);
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ push_consent: local, push_consent_at: new Date().toISOString() })
      .eq("id", userId);
    if (updErr) {
      console.warn("[Push] reconcile update failed", updErr);
      return;
    }
    console.info("[Push] reconciled local→profile consent=", local);
  } catch (e) {
    console.warn("[Push] reconcile threw", e);
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const reconciledForUserRef = useRef<string | null>(null);

  useEffect(() => {
    const maybeReconcile = (nextUser: User | null) => {
      if (!nextUser) return;
      if (reconciledForUserRef.current === nextUser.id) return;
      reconciledForUserRef.current = nextUser.id;
      // Defer so we never block auth state propagation.
      setTimeout(() => { void reconcileLocalConsent(nextUser.id); }, 0);
      setTimeout(() => { reconcileCachedAppleName(nextUser.id); }, 0);
      setAppsFlyerUserId(nextUser.id);
    };

    const isCallbackPath = () => {
      if (typeof window === "undefined") return false;
      const p = window.location.pathname;
      return p.startsWith("/auth/callback") || p.startsWith("/callback");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      // Defensive: if a persisted session belongs to a user who never
      // confirmed their email, drop it. Skip the check while we're on
      // /callback or /auth/callback so the verification flow can complete.
      if (nextUser && !nextUser.email_confirmed_at && !isCallbackPath()) {
        console.warn("[AuthVerify] dropping unconfirmed session for", nextUser.email);
        setSession(null);
        setUser(null);
        setLoading(false);
        void supabase.auth.signOut();
        return;
      }
      setSession(session);
      setUser(nextUser);
      setLoading(false);
      maybeReconcile(nextUser);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const nextUser = session?.user ?? null;
        if (nextUser && !nextUser.email_confirmed_at && !isCallbackPath()) {
          console.warn("[AuthVerify] initial session unconfirmed, signing out", nextUser.email);
          setSession(null);
          setUser(null);
          setLoading(false);
          void supabase.auth.signOut();
          return;
        }
        setSession(session);
        setUser(nextUser);
        setLoading(false);
        maybeReconcile(nextUser);
      })
      .catch((e) => {
        console.warn("[AuthVerify] getSession failed", e);
        // Never leave the app in a stale Loading state if bootstrap fails.
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const redirect = resolveAuthRedirect("/auth/callback");
    console.info("[AuthVerify] signup requested email=", email, "redirect=", redirect);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: redirect,
      },
    });
    if (error) console.warn("[AuthVerify] signup error", error.message);
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // Block sign-in if the user has not confirmed their email yet.
    // Without this, a user can sign up, switch to the Login tab, and enter
    // the app before clicking the verification link.
    if (data.user && !data.user.email_confirmed_at) {
      console.warn("[AuthVerify] blocked sign-in for unconfirmed email", email);
      await supabase.auth.signOut();
      return { error: "Email not confirmed" };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resolveAuthRedirect("/reset-password"),
    });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
