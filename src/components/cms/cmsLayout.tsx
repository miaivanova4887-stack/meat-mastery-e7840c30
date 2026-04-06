import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CmsLayoutField {
  key: string;
  label: string;
  type?: string;
}

export interface CmsLayoutBlock {
  id?: string;
  name: string;
  blockType?: string;
  fields?: CmsLayoutField[];
  content?: Record<string, Record<string, string>>;
}

function makeFallbackBlockId(seed: string, index: number) {
  return `cms-block-${seed}-${index}`;
}

function normalizeFieldLocales(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      en: typeof record.en === "string" ? record.en : "",
      fr: typeof record.fr === "string" ? record.fr : "",
    };
  }

  if (typeof value === "string") {
    return { en: value, fr: "" };
  }

  return { en: "", fr: "" };
}

export function normalizeLayoutBlocks(blocks: unknown, seed: string): CmsLayoutBlock[] {
  if (!Array.isArray(blocks)) return [];

  return blocks.map((rawBlock, index) => {
    const block = rawBlock && typeof rawBlock === "object" ? rawBlock as Record<string, unknown> : {};
    const rawFields = Array.isArray(block.fields) ? block.fields : [];
    const rawContent = block.content && typeof block.content === "object" && !Array.isArray(block.content)
      ? block.content as Record<string, unknown>
      : {};

    return {
      id: typeof block.id === "string" && block.id ? block.id : makeFallbackBlockId(seed, index),
      name: typeof block.name === "string" && block.name
        ? block.name
        : typeof block.blockType === "string" && block.blockType
          ? block.blockType
          : `Block ${index + 1}`,
      blockType: typeof block.blockType === "string" ? block.blockType : undefined,
      fields: rawFields.map((rawField, fieldIndex) => {
        const field = rawField && typeof rawField === "object" ? rawField as Record<string, unknown> : {};
        const key = typeof field.key === "string" && field.key ? field.key : `field_${fieldIndex}`;

        return {
          key,
          label: typeof field.label === "string" && field.label ? field.label : key,
          type: typeof field.type === "string" ? field.type : "text",
        };
      }),
      content: Object.fromEntries(
        Object.entries(rawContent).map(([fieldKey, value]) => [fieldKey, normalizeFieldLocales(value)])
      ),
    };
  });
}

function getLocalizedValue(block: CmsLayoutBlock, fieldKey: string, locale: string): string {
  const fieldContent = block.content?.[fieldKey];
  if (!fieldContent) return "";

  return fieldContent[locale] || fieldContent.en || "";
}

function isInternalLink(url: string): boolean {
  return url.startsWith("/") || url.startsWith("#");
}

function LayoutBlockView({ block, locale }: { block: CmsLayoutBlock; locale: string }) {
  const type = block.blockType || block.name;

  switch (type) {
    case "rich_text": {
      const body = getLocalizedValue(block, "body", locale);
      return body ? <p className="whitespace-pre-wrap leading-relaxed text-foreground">{body}</p> : null;
    }

    case "title_body": {
      const title = getLocalizedValue(block, "title", locale);
      const body = getLocalizedValue(block, "body", locale);

      return (
        <section className="space-y-2">
          {title ? <h2 className="text-xl font-bold text-foreground">{title}</h2> : null}
          {body ? <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{body}</p> : null}
        </section>
      );
    }

    case "cta_button": {
      const label = getLocalizedValue(block, "label", locale) || "Click here";
      const link = getLocalizedValue(block, "link", locale);

      if (!link) {
        return <Button>{label}</Button>;
      }

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
          {title ? <AlertTitle>{title}</AlertTitle> : null}
          {body ? <AlertDescription>{body}</AlertDescription> : null}
        </Alert>
      );
    }

    case "image_block": {
      const src = getLocalizedValue(block, "src", locale);
      const alt = getLocalizedValue(block, "alt", locale);

      return src ? (
        <img src={src} alt={alt} loading="lazy" className="h-auto max-w-full rounded-lg" />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          Image placeholder
        </div>
      );
    }

    case "spacer":
      return <div className="h-8" />;

    default:
      return (
        <div className="space-y-1">
          {(block.fields || []).map((field) => {
            const value = getLocalizedValue(block, field.key, locale);

            return value ? (
              <p key={field.key} className="text-foreground">
                <span className="font-medium">{field.label}: </span>
                {value}
              </p>
            ) : null;
          })}
        </div>
      );
  }
}

interface CmsLayoutDocumentProps {
  blocks: unknown;
  className?: string;
  emptyState?: ReactNode;
  locale: string;
  showTitle?: boolean;
  title?: string;
}

export function CmsLayoutDocument({
  blocks,
  className,
  emptyState,
  locale,
  showTitle = true,
  title,
}: CmsLayoutDocumentProps) {
  const normalizedBlocks = normalizeLayoutBlocks(blocks, title || "page");

  return (
    <div className={cn("bg-background", className)}>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {showTitle && title ? <h1 className="text-2xl font-bold text-foreground">{title}</h1> : null}
        {normalizedBlocks.length > 0
          ? normalizedBlocks.map((block, index) => (
              <LayoutBlockView key={`${block.id || block.name}-${index}`} block={block} locale={locale} />
            ))
          : emptyState || null}
      </div>
    </div>
  );
}