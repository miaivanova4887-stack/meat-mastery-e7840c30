import { PlacedComponent } from "./cmsTypes";

interface Props {
  components: PlacedComponent[];
}

function renderComponent(comp: PlacedComponent) {
  const { type, props, width, height } = comp;
  const style = { width, height };

  switch (type) {
    case "text":
      return <p className="text-sm text-foreground" style={style}>{String(props.content || "")}</p>;
    case "heading": {
      const level = Number(props.level || 2);
      const cls = level === 1 ? "text-3xl" : level === 2 ? "text-2xl" : "text-xl";
      return <h2 className={`${cls} font-bold text-foreground`} style={style}>{String(props.content || "")}</h2>;
    }
    case "button":
      return <button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium" style={style}>{String(props.text || "Button")}</button>;
    case "image":
      return props.src
        ? <img src={String(props.src)} alt={String(props.alt || "")} className="object-cover rounded" style={style} />
        : <div className="bg-muted rounded flex items-center justify-center text-muted-foreground text-xs" style={style}>Image placeholder</div>;
    case "divider":
      return <hr className="border-border" style={{ width }} />;
    case "spacer":
      return <div style={{ height: Number(props.height || 32) }} />;
    case "card":
      return (
        <div className="border border-border rounded-lg p-4 bg-card" style={style}>
          <h3 className="font-semibold text-card-foreground">{String(props.title || "Card")}</h3>
        </div>
      );
    case "input":
      return (
        <div style={style}>
          <label className="text-sm font-medium text-foreground block mb-1">{String(props.label || "Label")}</label>
          <input className="w-full border border-border rounded px-3 py-2 text-sm bg-background" placeholder={String(props.placeholder || "")} />
        </div>
      );
    case "list":
      return (
        <ul className="list-disc pl-5 space-y-1" style={style}>
          {(Array.isArray(props.items) ? props.items : []).map((item, i) => (
            <li key={i} className="text-sm text-foreground">{String(item)}</li>
          ))}
        </ul>
      );
    case "badge":
      return <span className="bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full">{String(props.text || "Badge")}</span>;
    case "navbar":
      return (
        <nav className="flex items-center gap-6 px-4 h-14 border-b border-border bg-card" style={{ width }}>
          {(Array.isArray(props.items) ? props.items : []).map((item, i) => (
            <span key={i} className="text-sm font-medium text-foreground">{String(item)}</span>
          ))}
        </nav>
      );
    case "progress_milestone": {
      const colors: Record<string, string> = { emerald: "bg-emerald-500/10 text-emerald-600", amber: "bg-amber-500/10 text-amber-600", blue: "bg-blue-500/10 text-blue-600", primary: "bg-primary/10 text-primary" };
      const c = colors[String(props.color || "emerald")] || colors.emerald;
      return (
        <div className="flex items-start gap-3 rounded-xl border border-border p-4" style={style}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${c}`}>{String(props.icon || "🏆")}</div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{String(props.title || "Milestone")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{String(props.desc || "")}</p>
          </div>
        </div>
      );
    }
    case "milestone_streak":
      return (
        <div className="flex items-center gap-3 rounded-xl border border-border p-4" style={style}>
          <span className="text-3xl">🔥</span>
          <div>
            <div className="text-2xl font-bold text-foreground">{String(props.days || 7)}</div>
            <div className="text-xs text-muted-foreground">{String(props.label || "Day Streak")}</div>
          </div>
        </div>
      );
    case "favorite_button":
      return (
        <button className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent" style={style}>
          <span>{props.filled ? "❤️" : "🤍"}</span>
          {String(props.label || "Favorite")}
        </button>
      );
    case "share_card":
      return (
        <div className="rounded-xl border border-border p-4" style={style}>
          <h3 className="text-sm font-semibold text-foreground">{String(props.title || "Invite")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{String(props.description || "")}</p>
          <div className="flex gap-2 mt-3">
            {["Share", "WhatsApp", "Email", "Copy Link"].map(b => (
              <span key={b} className="px-3 py-1.5 rounded-xl bg-secondary text-xs font-medium text-muted-foreground">{b}</span>
            ))}
          </div>
        </div>
      );
    case "feed_card": {
      const feedColors: Record<string, string> = { blue: "bg-blue-500/10 text-blue-600", emerald: "bg-emerald-500/10 text-emerald-600", amber: "bg-amber-500/10 text-amber-600", primary: "bg-primary/10 text-primary" };
      const fc = feedColors[String(props.color || "blue")] || feedColors.blue;
      return (
        <article className="rounded-xl border border-border p-4" style={style}>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${fc}`}>{String(props.category || "News")}</span>
          <h3 className="text-sm font-semibold text-foreground mt-1.5">{String(props.title || "Article")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{String(props.summary || "")}</p>
        </article>
      );
    }
    case "stat_card":
      return (
        <div className="flex items-center gap-3 rounded-xl border border-border p-4" style={style}>
          <span className="text-2xl">{String(props.icon || "📊")}</span>
          <div>
            <div className="text-xl font-bold text-foreground">{String(props.value || "0")}</div>
            <div className="text-xs text-muted-foreground">{String(props.label || "Metric")} <span className="text-muted-foreground/60">{String(props.unit || "")}</span></div>
          </div>
        </div>
      );
    case "goal_progress": {
      const cur = Number(props.current || 0);
      const tar = Number(props.target || 100);
      const pct = Math.min(100, Math.round((cur / tar) * 100));
      return (
        <div className="rounded-xl border border-border p-4" style={style}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">{String(props.label || "Goal")}</span>
            <span className="text-xs text-muted-foreground">{cur}/{tar}{String(props.unit || "")}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    }
    default:
      return <div className="bg-muted rounded p-2 text-xs text-muted-foreground" style={style}>{comp.label}</div>;
  }
}

export default function CmsPageRenderer({ components }: Props) {
  return (
    <div className="relative" style={{ minHeight: 400 }}>
      {components.map(comp => (
        <div key={comp.id} style={{ position: "absolute", left: comp.x, top: comp.y }}>
          {renderComponent(comp)}
        </div>
      ))}
    </div>
  );
}
