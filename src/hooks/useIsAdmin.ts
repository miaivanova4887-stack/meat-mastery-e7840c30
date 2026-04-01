import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useIsAdmin = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef(userId);

  if (prevUserIdRef.current !== userId) {
    prevUserIdRef.current = userId;
    if (userId) {
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
    setLoading(true);
    const check = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data && !error);
      setLoading(false);
    };
    check();
  }, [userId]);

  return { isAdmin, loading };
};
