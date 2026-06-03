import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resetViewportScale } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const TITLE_MAX = 120;
const BODY_MAX = 2000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const CreatePostSheet = ({ open, onClose, onCreated }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const postSchema = z.object({
    title: z.string().trim().max(TITLE_MAX).optional().or(z.literal("")),
    body: z.string().trim().min(1, t("community.post.writeSomething")).max(BODY_MAX),
  });

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setTitle("");
      setBody("");
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  if (!open) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|jpg)$/.test(file.type)) {
      toast.error(t("community.post.imageTypeError"));
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error(t("community.post.imageSizeError"));
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t("community.post.signInToPost"));
      return;
    }
    const parsed = postSchema.safeParse({ title, body });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || t("community.post.invalidInput"));
      return;
    }

    setSaving(true);
    try {
      let image_url: string | null = null;

      if (imageFile) {
        const ext = (imageFile.name.split(".").pop() || "jpg").toLowerCase();
        const objectId = crypto.randomUUID();
        const path = `${user.id}/posts/${objectId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("recipe-images")
          .upload(path, imageFile, { upsert: false, contentType: imageFile.type });
        if (upErr) {
          throw new Error(`${t("community.post.imageUploadFailed")}: ${upErr.message}`);
        }
        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const { error: insertErr } = await (supabase as any)
        .from("community_posts")
        .insert({
          user_id: user.id,
          title: parsed.data.title?.trim() || null,
          body: parsed.data.body.trim(),
          image_url,
        });
      if (insertErr) throw insertErr;

      toast.success(t("community.post.published"));
      onCreated();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("community.post.publishError");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const bodyValid = body.trim().length > 0 && body.trim().length <= BODY_MAX;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={() => !saving && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-t-2xl p-5 shadow-xl animate-in slide-in-from-bottom max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-bold text-foreground">
            {t("community.create.writePost")}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-muted-foreground disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {t("community.post.titleLabel")}
          </span>
          <input
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={resetViewportScale}
            placeholder={t("community.post.titlePlaceholder")}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-secondary text-base md:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="block mt-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {t("community.post.bodyLabel")}
          </span>
          <textarea
            value={body}
            maxLength={BODY_MAX}
            onChange={(e) => setBody(e.target.value)}
            onBlur={resetViewportScale}
            placeholder={t("community.post.bodyPlaceholder")}
            rows={5}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-secondary text-base md:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[120px]"
          />

          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-muted-foreground">
              {body.trim().length}/{BODY_MAX}
            </span>
          </div>
        </label>

        <div className="mt-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {t("community.post.imageLabel")}
          </span>
          {imagePreview ? (
            <div className="mt-1 relative rounded-xl overflow-hidden border border-border/40">
              <img src={imagePreview} alt="" className="w-full h-auto max-h-[280px] object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                aria-label={t("community.post.removeImage")}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 w-full py-3 rounded-xl border border-dashed border-border bg-secondary/40 text-muted-foreground text-xs flex items-center justify-center gap-2 hover:bg-secondary/70 transition-colors"
            >
              <Camera size={14} /> {t("community.post.uploadImage")}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!bodyValid || saving}
          className="mt-5 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> {t("community.post.publishing")}
            </>
          ) : (
            t("community.post.publish")
          )}
        </button>
      </div>
    </div>
  );
};

export default CreatePostSheet;
