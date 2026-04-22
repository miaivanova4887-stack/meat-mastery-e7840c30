import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useIsAdmin = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef<string | undefined>(userId);

  // Detect a userId transition during render. If it changed, treat this render
  // as "loading" so consumers don't see a stale (loading=false, isAdmin=false)
  // snapshot and redirect prematurely. Also schedule the state reset for the
  // next render so the effect re-runs with the new userId.
  let effectiveLoading = loading;
  let effectiveIsAdmin = isAdmin;
  if (prevUserIdRef.current !== userId) {
    prevUserIdRef.current = userId;
    if (userId) {
      effectiveLoading = true;
      effectiveIsAdmin = false;
      setLoading(true);
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const check = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      const result = !!data && !error;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[useIsAdmin]", { userId, isAdmin: result, error: error?.message });
      }
      setIsAdmin(result);
      setLoading(false);
    };
    check();
    return () => { cancelled = true; };
  }, [userId]);

  return { isAdmin: effectiveIsAdmin, loading: effectiveLoading };
};
