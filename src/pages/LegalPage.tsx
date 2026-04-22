import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface LegalPageProps {
  ns: "privacy" | "terms" | "disclaimer";
}

const LegalPage = ({ ns }: LegalPageProps) => {
  const { t } = useTranslation();
  const title = t(`${ns}.main.title`);

  useEffect(() => {
    document.title = `${title} · CarnivoreX`;
  }, [title]);

  return (
    <main
      className="min-h-screen px-4 pb-24 max-w-2xl mx-auto"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
    >
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
