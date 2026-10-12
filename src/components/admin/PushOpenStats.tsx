import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Push open rate: taps recorded on devices vs. pushes sent (last 30 days). */
const PushOpenStats = () => {
  const [stats, setStats] = useState<{ opens: number; devices: number; sent: number } | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    (async () => {
      const db = supabase as any;
      const [opens, anon, runs] = await Promise.all([
        db.from("push_open_events").select("device_id").gte("created_at", since).limit(5000),
        db.from("push_anon_sends").select("id", { count: "exact", head: true }).gte("created_at", since),
        db.from("push_campaign_runs").select("id", { count: "exact", head: true }).eq("status", "done").gte("updated_at", since),
      ]);
      const rows = (opens.data ?? []) as { device_id: string }[];
      setStats({
        opens: rows.length,
        devices: new Set(rows.map((r) => r.device_id)).size,
        sent: (anon.count ?? 0) + (runs.count ?? 0),
      });
    })();
  }, []);

  const rate = stats && stats.sent > 0 ? ((stats.opens / stats.sent) * 100).toFixed(1) : null;
  const cells = [
    ["Pushes sent", stats?.sent ?? "…"],
    ["Opens", stats?.opens ?? "…"],
    ["Devices opened", stats?.devices ?? "…"],
    ["Open rate", rate != null ? `${rate}%` : "—"],
  ];

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 mb-4">
      <p className="text-sm font-semibold text-foreground mb-3">Push opens · last 30 days</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cells.map(([label, v]) => (
          <div key={label as string}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Opens are recorded from app version with this update onward.</p>
    </div>
  );
};

export default PushOpenStats;
