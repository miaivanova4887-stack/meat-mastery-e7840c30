import { ArrowLeft, Loader2, Shield, BellRing, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ReminderRow {
  id: string;
  sent_at: string;
  offset_minutes: number;
  channel: string;
  success: boolean;
  error: string | null;
  session_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  scheduled_at: string | null;
  timezone: string | null;
  booking_url: string | null;
}

type StatusFilter = "all" | "success" | "failure";

function offsetLabel(min: number): string {
  if (min === 1440) return "24h";
  if (min >= 60) return `${min / 60}h`;
  return `${min}m`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const AdminCoachingReminders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, navigate]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-coaching-reminders?status=${status}&limit=200`;
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
      });
      if (!res.ok) {
        toast.error("Failed to load reminders");
        setRows([]);
        return;
      }
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e) {
      toast.error("Failed to load reminders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (isAdmin) void fetchRows();
  }, [isAdmin, fetchRows]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Admin access required.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 text-sm font-semibold text-primary"
        >
          Go home
        </button>
      </div>
    );
  }

  const successes = rows.filter((r) => r.success).length;
  const failures = rows.length - successes;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header
        className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <div className="px-4 pb-4">
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center text-sm text-muted-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Coaching reminders</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {rows.length} attempts · {successes} sent · {failures} failed
              </p>
            </div>
            <button
              onClick={() => void fetchRows()}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            {(["all", "success", "failure"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s === "all" ? "All" : s === "success" ? "Sent" : "Failures"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 max-w-2xl mx-auto space-y-2">
        {loading && rows.length === 0 ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="ios-card p-6 text-center">
            <BellRing className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">No reminder attempts yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Only scheduled cron reminders are logged here. Test reminders triggered from Profile are not recorded.
            </p>
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="ios-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {offsetLabel(r.offset_minutes)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {r.channel}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-foreground truncate">
                    {r.user_name || r.user_email || r.user_id.slice(0, 8)}
                  </div>
                  {r.user_email && r.user_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {r.user_email}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Sent {formatWhen(r.sent_at)} · Session at {formatWhen(r.scheduled_at)}
                  </div>
                  {!r.success && r.error && (
                    <div className="mt-1.5 text-xs text-destructive break-words">
                      {r.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default AdminCoachingReminders;
