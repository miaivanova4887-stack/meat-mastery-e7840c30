import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlacedComponent } from "@/components/cms/cmsTypes";
import CmsPageRenderer from "@/components/cms/CmsPageRenderer";

export default function CmsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const [layout, setLayout] = useState<PlacedComponent[] | null>(null);
  const [title, setTitle] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("cms_pages")
        .select("title, layout")
        .eq("slug", slug)
        .eq("published", true)
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setTitle(data.title);
        setLayout(data.layout as unknown as PlacedComponent[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading…</div>;
  if (notFound) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Page not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
        <div className="relative" style={{ minHeight: 400 }}>
          {layout && <CmsPageRenderer components={layout} />}
        </div>
      </div>
    </div>
  );
}
