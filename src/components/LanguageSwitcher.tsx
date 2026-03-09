import { useTranslation } from "react-i18next";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("fr") ? "fr" : "en";

  const toggle = () => {
    const next = current === "en" ? "fr" : "en";
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/80 text-xs font-semibold text-foreground transition-all active:scale-95"
      aria-label="Toggle language"
    >
      <span className={current === "en" ? "opacity-100" : "opacity-40"}>EN</span>
      <span className="text-muted-foreground">/</span>
      <span className={current === "fr" ? "opacity-100" : "opacity-40"}>FR</span>
    </button>
  );
};

export default LanguageSwitcher;
