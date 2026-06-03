interface Props {
  title: string;
  body: string;
  appName?: string;
}

/** iOS-style notification preview card. */
export default function NotificationPreviewCard({ title, body, appName = "CarnivoreX" }: Props) {
  return (
    <div className="rounded-2xl bg-secondary/80 border border-border/40 p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 text-lg">
          🔥
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {appName}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">now</span>
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5 break-words">
            {title || <span className="text-muted-foreground italic">Title…</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 break-words whitespace-pre-wrap">
            {body || <span className="italic">Body…</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
