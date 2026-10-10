import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Row {
  device_id: string;
  event_type: string;
  step: number | null;
  question: string | null;
  answers: string[];
  created_at: string;
}

const RANGES = [7, 30, 90] as const;

export default function OnboardingInsights() {
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setRows(null);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    (supabase as any)
      .from("onboarding_insights")
      .select("device_id,event_type,step,question,answers,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000)
      .then(({ data }: { data: Row[] | null }) => setRows(data ?? []));
  }, [days]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const started = new Set<string>();
    const completed = new Set<string>();
    const skipped = new Set<string>();
    const skipByStep = new Map<number, Set<string>>();
    // latest answer per device per step
    const latest = new Map<string, Row>();
    for (const r of rows) {
      started.add(r.device_id);
      if (r.event_type === "completed") completed.add(r.device_id);
      if (r.event_type === "skipped") {
        skipped.add(r.device_id);
        const s = r.step ?? 0;
        if (!skipByStep.has(s)) skipByStep.set(s, new Set());
        skipByStep.get(s)!.add(r.device_id);
      }
      if (r.event_type === "step_answered" && r.step != null) {
        const k = `${r.device_id}|${r.step}`;
        if (!latest.has(k)) latest.set(k, r); // rows are newest-first
      }
    }
    const questions = new Map<number, { title: string; respondents: number; counts: Map<string, number> }>();
    for (const r of latest.values()) {
      const q = questions.get(r.step!) ?? { title: r.question ?? `Step ${r.step}`, respondents: 0, counts: new Map() };
      q.respondents++;
      for (const a of r.answers) q.counts.set(a, (q.counts.get(a) ?? 0) + 1);
      questions.set(r.step!, q);
    }
    return {
      started: started.size,
      completed: completed.size,
      skipped: skipped.size,
      skipByStep: [...skipByStep.entries()].sort((a, b) => a[0] - b[0]).map(([s, set]) => [s, set.size] as const),
      questions: [...questions.entries()].sort((a, b) => a[0] - b[0]),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {RANGES.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`text-xs px-3 py-1.5 rounded-full border ${days === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {!stats ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : stats.started === 0 ? (
        <div className="ios-card p-6 text-center text-sm text-muted-foreground">
          No onboarding activity yet. Data starts collecting from the new app version.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Started", stats.started],
              ["Completed", stats.completed],
              ["Skipped", stats.skipped],
            ].map(([label, n]) => (
              <div key={label as string} className="ios-card p-3 text-center">
                <div className="text-xl font-bold text-foreground">{n}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
                {label !== "Started" && (
                  <div className="text-[10px] text-primary font-medium">
                    {Math.round(((n as number) / stats.started) * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>

          {stats.skipByStep.length > 0 && (
            <div className="ios-card p-4">
              <h3 className="text-sm font-semibold mb-2">Where people skip</h3>
              {stats.skipByStep.map(([s, n]) => (
                <Bar key={s} label={`Step ${s}`} value={n} total={stats.skipped} />
              ))}
            </div>
          )}

          {stats.questions.map(([step, q]) => (
            <div key={step} className="ios-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Step {step} · {q.respondents} answered</div>
              <h3 className="text-sm font-semibold mb-2">{q.title}</h3>
              {[...q.counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => (
                <Bar key={label} label={label.replace(/_/g, " ")} value={n} total={q.respondents} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground truncate pr-2">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
