import { ChefHat, MessageSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  onShareRecipe: () => void;
  onWritePost: () => void;
}

const CreateChoiceSheet = ({ open, onClose, onShareRecipe, onWritePost }: Props) => {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-t-2xl p-5 pb-8 shadow-xl animate-in slide-in-from-bottom"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-bold text-foreground">
            {t("community.create.title")}
          </h2>
          <button onClick={onClose} className="text-muted-foreground" aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onShareRecipe}
            className="ios-card p-4 flex flex-col items-start gap-2 hover:bg-secondary/60 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ChefHat size={20} className="text-primary" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">
              {t("community.create.shareRecipe")}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("community.create.shareRecipeDesc")}
            </p>
          </button>

          <button
            onClick={onWritePost}
            className="ios-card p-4 flex flex-col items-start gap-2 hover:bg-secondary/60 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <MessageSquare size={20} className="text-accent-foreground" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">
              {t("community.create.writePost")}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("community.create.writePostDesc")}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateChoiceSheet;
