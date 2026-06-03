import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CmsLayoutDocument } from "@/components/cms/cmsLayout";

export default function CmsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const BackButton = () => (
    <button
      type="button"
      onClick={handleBack}
      aria-label={t("common.back")}
      className="fixed z-40 inline-flex items-center justify-center h-10 w-10 rounded-full bg-background/80 backdrop-blur text-foreground hover:bg-muted/60 transition-colors shadow-sm"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        left: "0.75rem",
      }}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        <BackButton />
        Loading…
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <BackButton />
        <p className="text-muted-foreground">Page not found</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted/60"
          >
            {t("common.back")}
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
          >
            Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <BackButton />
      <CmsLayoutDocument
        title={title}
        blocks={blocks}
        locale={locale}
        className="min-h-screen pb-20"
      />
    </>
  );
}
