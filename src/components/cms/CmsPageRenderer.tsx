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
