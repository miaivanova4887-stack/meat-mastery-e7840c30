import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Apple Guideline 5.1.1 — pre-prompt explainer + re-entry modal.
 *
 * Two distinct modes:
 *
 * 1. "purpose" (shown BEFORE the iOS system camera prompt) — explains
 *    why we want the camera. User taps Continue → caller then calls
 *    getUserMedia / the native picker. No auto-redirect on denial.
 *
 * 2. "denied" (shown LATER, only when the user taps a camera-only
 *    feature after previously denying) — neutral copy with "Not now"
 *    and "Open Settings" as equal options.
 */
export type CameraExplainerMode = "purpose" | "denied";

interface Props {
  open: boolean;
  mode: CameraExplainerMode;
  onClose: () => void;
  onContinue: () => void;
}

const CameraPermissionExplainer = ({ open, mode, onClose, onContinue }: Props) => {
  const isPurpose = mode === "purpose";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl p-6 gap-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Camera size={26} className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {isPurpose ? "Camera access" : "Camera is off"}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isPurpose
              ? "Camera access lets you scan barcodes and snap meals so we can log macros from a single photo. You can change this anytime in Settings."
              : "Camera access is currently off for CarnivoreX. You can keep using the app without it, or enable it in Settings."}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Not now
          </Button>
          <Button className="flex-1" onClick={onContinue}>
            {isPurpose ? "Continue" : "Open Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraPermissionExplainer;
