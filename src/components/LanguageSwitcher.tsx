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
      className="relative flex items-center w-[52px] h-7 rounded-full bg-black/30 backdrop-blur-md border border-white/10 transition-all active:scale-95"
      aria-label="Toggle language"
    >
      {/* Sliding indicator */}
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white/90 shadow-sm transition-transform duration-200 ease-out ${
          current === "fr" ? "translate-x-[24px]" : "translate-x-0.5"
        }`}
      />
      {/* Labels */}
      <span
        className={`relative z-10 flex-1 text-center text-[10px] font-bold tracking-wide transition-colors duration-200 ${
          current === "en" ? "text-black" : "text-white/60"
        }`}
      >
        EN
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-[10px] font-bold tracking-wide transition-colors duration-200 ${
          current === "fr" ? "text-black" : "text-white/60"
        }`}
      >
        FR
      </span>
    </button>
  );
};

export default LanguageSwitcher;
