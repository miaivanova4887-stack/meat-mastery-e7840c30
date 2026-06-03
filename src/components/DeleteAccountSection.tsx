import { useState } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * App Store Guideline 5.1.1(v) — in-app account deletion.
 * Two-step destructive flow:
 *   1. Open confirmation dialog.
 *   2. User must type DELETE to enable the final destructive button.
 *   3. On success show a terminal "deleted" state, sign the user out.
 */
const DeleteAccountSection = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const reset = () => {
    setConfirm("");
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      setDeleted(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not delete account. Please try again.");
      setLoading(false);
    }
  };

  const handleDone = async () => {
    try { await signOut(); } catch { /* ignore */ }
    setOpen(false);
    setDeleted(false);
    reset();
    navigate("/");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full ios-card p-4 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors"
      >
        <Trash2 size={18} />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">Delete account</p>
          <p className="text-[11px] text-destructive/70 mt-0.5">
            Permanently remove your account and data
          </p>
        </div>
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (loading) return;
          setOpen(v);
          if (!v) { reset(); setDeleted(false); }
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          {!deleted ? (
            <>
              <DialogHeader>
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                  <AlertTriangle size={22} className="text-destructive" />
                </div>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription className="text-left space-y-2 pt-1">
                  <span className="block">
                    This permanently deletes your CarnivoreX account, profile,
                    recipes, progress entries, goals, and preferences. This
                    cannot be undone.
                  </span>
                  <span className="block text-xs">
                    Active App Store subscriptions are not cancelled by this
                    action — manage them anytime in <strong>Settings →
                    Apple ID → Subscriptions</strong>.
                  </span>
                  <span className="block text-xs pt-1">
                    Type <strong>DELETE</strong> below to confirm.
                  </span>
                </DialogDescription>
              </DialogHeader>

              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                autoComplete="off"
                disabled={loading}
              />

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setOpen(false); reset(); }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={confirm.trim() !== "DELETE" || loading}
                  onClick={handleDelete}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : "Delete forever"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Account deleted</DialogTitle>
                <DialogDescription className="pt-1">
                  Your CarnivoreX account and personal data have been removed.
                  We're sorry to see you go.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button className="w-full" onClick={handleDone}>OK</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeleteAccountSection;
