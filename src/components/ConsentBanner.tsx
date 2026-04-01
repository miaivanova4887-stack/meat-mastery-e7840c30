import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const LS_CONSENT_GIVEN = "carnivore-consent-given";
const LS_CONSENT_DISMISSED = "carnivore-consent-dismissed";

const ConsentBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [buttonText, setButtonText] = useState("I Accept");

  useEffect(() => {
    if (!user) return;

    const checkConsent = async () => {
      // Check localStorage first (fast)
      if (
        localStorage.getItem(LS_CONSENT_GIVEN) === "true" ||
        localStorage.getItem(LS_CONSENT_DISMISSED) === "true"
      ) {
        return;
      }

      // Check DB
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_attributes")
        .eq("id", user.id)
        .single();

      if (
        profile?.user_attributes &&
        typeof profile.user_attributes === "object" &&
        !Array.isArray(profile.user_attributes) &&
        (profile.user_attributes as Record<string, unknown>).consent_given === true
      ) {
        localStorage.setItem(LS_CONSENT_GIVEN, "true");
        return;
      }

      // Fetch content
      const locale = i18n.language?.startsWith("fr") ? "fr" : "en";
      const { data: blocks } = await supabase
        .from("content_blocks")
        .select("key, value")
        .eq("page", "consent")
        .eq("section", "banner")
        .eq("locale", locale);

      if (blocks) {
        const body = blocks.find((b) => b.key === "body");
        const btn = blocks.find((b) => b.key === "accept_button");
        if (body) setBodyText(body.value);
        if (btn) setButtonText(btn.value);
      }

      setVisible(true);
    };

    checkConsent();
  }, [user, i18n.language]);

  const dismiss = () => {
    setDismissing(true);
    setTimeout(() => setVisible(false), 300);
  };

  const handleAccept = async () => {
    if (!user) return;

    // Merge consent_given into user_attributes
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_attributes")
      .eq("id", user.id)
      .single();

    const existing =
      profile?.user_attributes &&
      typeof profile.user_attributes === "object" &&
      !Array.isArray(profile.user_attributes)
        ? (profile.user_attributes as Record<string, unknown>)
        : {};

    await supabase
      .from("profiles")
      .update({ user_attributes: { ...existing, consent_given: true } })
      .eq("id", user.id);

    localStorage.setItem(LS_CONSENT_GIVEN, "true");
    dismiss();
  };

  const handleClose = () => {
    localStorage.setItem(LS_CONSENT_DISMISSED, "true");
    dismiss();
  };

  if (!visible || !user) return null;

  // Split body text to make "Privacy Policy" / "Politique de confidentialité" a link
  const privacyLabel = i18n.language?.startsWith("fr")
    ? "Politique de confidentialité"
    : "Privacy Policy";
  const parts = bodyText.split(privacyLabel);

  return (
    <div
      className={`mx-4 mt-4 bg-card border border-border/50 rounded-xl p-4 relative transition-all duration-300 ${
        dismissing
          ? "opacity-0 -translate-y-4"
          : "animate-[slideDown_0.3s_ease-out]"
      }`}
      style={{ animationFillMode: "forwards" }}
    >
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1"
        aria-label="Close"
      >
        <X size={16} />
      </button>

      <p className="text-sm text-foreground pr-6 mb-4">
        {parts.length > 1 ? (
          <>
            {parts[0]}
            <button
              onClick={() => navigate("/privacy")}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {privacyLabel}
            </button>
            {parts[1]}
          </>
        ) : (
          bodyText
        )}
      </p>

      <button
        onClick={handleAccept}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
      >
        {buttonText}
      </button>
    </div>
  );
};

export default ConsentBanner;
