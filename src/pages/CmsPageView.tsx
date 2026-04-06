import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface LayoutField {
  key: string;
  label: string;
  type: string;
}

interface LayoutBlock {
  name: string;
  blockType?: string;
  fields: LayoutField[];
  content: Record<string, Record<string, string>>;
}

function getLocalizedValue(block: LayoutBlock, fieldKey: string, locale: string): string {
  const fieldContent = block.content?.[fieldKey];
  if (!fieldContent) return "";
  return fieldContent[locale] || fieldContent["en"] || "";
}

function isInternalLink(url: string): boolean {
  return url.startsWith("/") || url.startsWith("#");
}

function LayoutBlockRenderer({ block, locale }: { block: LayoutBlock; locale: string }) {
  const type = block.blockType || block.name;

  switch (type) {
    case "rich_text": {
      const body = getLocalizedValue(block, "body", locale);
      return body ? <p className="text-foreground leading-relaxed whitespace-pre-wrap">{body}</p> : null;
    }

    case "title_body": {
      const title = getLocalizedValue(block, "title", locale);
      const body = getLocalizedValue(block, "body", locale);
      return (
        <div className="space-y-2">
          {title && <h2 className="text-xl font-bold text-foreground">{title}</h2>}
          {body && <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{body}</p>}
        </div>
      );
    }

    case "cta_button": {
      const label = getLocalizedValue(block, "label", locale) || "Click here";
      const link = getLocalizedValue(block, "link", locale);
      if (!link) return <Button>{label}</Button>;
      if (isInternalLink(link)) {
        return (
          <Button asChild>
            <Link to={link}>{label}</Link>
          </Button>
        );
      }
      return (
        <Button asChild>
          <a href={link} target="_blank" rel="noopener noreferrer">{label}</a>
        </Button>
      );
    }

    case "notice": {
      const title = getLocalizedValue(block, "title", locale);
      const body = getLocalizedValue(block, "body", locale);
      return (
        <Alert>
          {title && <AlertTitle>{title}</AlertTitle>}
          {body && <AlertDescription>{body}</AlertDescription>}
        </Alert>
      );
    }

    case "image_block": {
      const src = getLocalizedValue(block, "src", locale);
      const alt = getLocalizedValue(block, "alt", locale);
      return src ? (
        <img src={src} alt={alt} className="rounded-lg max-w-full h-auto" />
      ) : (
        <div className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm h-48">
          Image placeholder
        </div>
      );
    }

    case "spacer":
      return <div className="h-8" />;

    default: {
      // Generic fallback: render all fields as key-value
      return (
        <div className="space-y-1">
          {block.fields.map((f) => {
            const val = getLocalizedValue(block, f.key, locale);
            return val ? (
              <p key={f.key} className="text-foreground">
                <span className="font-medium">{f.label}: </span>{val}
              </p>
            ) : null;
          })}
        </div>
      );
    }
  }
}

export default function CmsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const [blocks, setBlocks] = useState<LayoutBlock[] | null>(null);
  const [title, setTitle] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const locale = i18n.language?.startsWith("fr") ? "fr" : "en";

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("page_layouts")
        .select("title, blocks")
        .eq("page_slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setTitle(data.title);
        setBlocks(data.blocks as unknown as LayoutBlock[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading…</div>;
  if (notFound) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Page not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {blocks?.map((block, i) => (
          <LayoutBlockRenderer key={i} block={block} locale={locale} />
        ))}
      </div>
    </div>
  );
}
