import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  ns: "privacy" | "terms" | "disclaimer";
}

const LegalPage = ({ ns }: LegalPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const title = t(`${ns}.main.title`);

  useEffect(() => {
    document.title = `${title} · CarnivoreX`;
  }, [title]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/profile");
    }
  };

  return (
    <main
      className="min-h-screen px-4 pb-24 max-w-2xl lg:max-w-3xl mx-auto"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t("common.back")}
          className="inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-full text-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight mb-4 text-foreground">
        {title}
      </h1>
      <div className="text-sm text-muted-foreground/90 leading-relaxed whitespace-pre-line">
        {t(`${ns}.main.body`)}
      </div>
    </main>
  );
};

export default LegalPage;
