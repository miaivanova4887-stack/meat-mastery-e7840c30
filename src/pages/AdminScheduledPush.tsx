import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ScheduledPushEditor, {
  type CampaignRow,
  scheduleSummary,
} from "@/components/admin/ScheduledPushEditor";

export default function AdminScheduledPush() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CampaignRow | null>(null);

  useEffect(() => {
    document.title = "Scheduled Push · Admin";
  }, []);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate("/auth?returnTo=/admin/scheduled-push", { replace: true });
    else if (!isAdmin) navigate("/", { replace: true });
  }, [authLoading, roleLoading, user, isAdmin, navigate]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("push_campaigns")
      .select("id, name, active, trigger_type, schedule, steps, updated_at")
      .eq("trigger_type", "scheduled")
      .order("name");
    if (!error && data) setRows(data as CampaignRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchRows();
  }, [isAdmin, fetchRows]);

  const toggleActive = async (row: CampaignRow, next: boolean) => {
    const prev = row.active;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    const { error } = await (supabase as any)
      .from("push_campaigns")
      .update({ active: next })
      .eq("id", row.id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: prev } : r)));
      toast.error(error.message);
    } else {
      toast.success(next ? "Campaign activated" : "Campaign deactivated");
    }
  };

  if (authLoading || roleLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}
    >
      <div
        className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <BellRing size={18} className="text-primary" />
        <h1 className="text-lg font-bold tracking-tight flex-1">Scheduled Push</h1>
      </div>

      <div className="px-4 pt-5 space-y-3 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No scheduled campaigns yet.
          </div>
        ) : (
          rows.map((r) => {
            const locales = stepLocales(r.steps?.[0]);
            return (
              <div key={r.id} className="ios-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground truncate">{r.name}</h3>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          r.active
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {scheduleSummary(r.schedule)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {r.schedule?.preference_key}
                      </code>
                      {locales.map((l) => (
                        <span
                          key={l}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase"
                        >
                          {l}
                        </span>
                      ))}
                      {r.updated_at && (
                        <span className="text-[10px] text-muted-foreground/70">
                          Updated {new Date(r.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Switch checked={r.active} onCheckedChange={(v) => toggleActive(r, v)} />
                </div>
                <button
                  onClick={() => setEditing(r)}
                  className="w-full py-2 rounded-lg bg-secondary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-secondary/70"
                >
                  <Pencil size={12} /> Edit & preview
                </button>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <ScheduledPushEditor
          campaign={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRows((rs) => rs.map((r) => (r.id === saved.id ? saved : r)));
          }}
        />
      )}
    </div>
  );
}

function stepLocales(step: any): string[] {
  if (!step?.title) return [];
  if (typeof step.title === "string") return ["en"];
  return Object.keys(step.title).filter((k) => !!step.title[k]);
}
