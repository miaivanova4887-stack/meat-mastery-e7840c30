import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { CmsLayoutDocument } from "@/components/cms/cmsLayout";

export default function CmsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const [blocks, setBlocks] = useState<unknown>([]);
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
        setBlocks(data.blocks);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading…</div>;
  if (notFound) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Page not found</div>;

  return (
    <CmsLayoutDocument
      title={title}
      blocks={blocks}
      locale={locale}
      className="min-h-screen pb-20"
    />
  );
}
