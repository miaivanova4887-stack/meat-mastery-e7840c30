import { ArrowLeft, Bell, Send, Loader2, Shield, Users, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface SentNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  sent_push: boolean;
  sent_feed: boolean;
  created_at: string;
}

const CATEGORIES = [
  { key: "scienceNews", label: "🔬 Science & Research" },
  { key: "motivationNews", label: "⚡ Motivation" },
  { key: "caseStudyNews", label: "❤️ Case Studies" },
  { key: "tipNews", label: "💡 Tips & Tricks" },
  { key: "general", label: "📢 General" },
];

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [sendPush, setSendPush] = useState(true);
  const [sendFeed, setSendFeed] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Check admin role
  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, navigate]);

  // Fetch notification history
  const fetchHistory = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("admin_notifications")
      .select("id, title, body, category, sent_push, sent_feed, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data as SentNotification[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchHistory();
  }, [isAdmin, fetchHistory]);

  const handleSend = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!sendPush && !sendFeed) { toast.error("Select at least one delivery method"); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-send-notification", {
        body: {
          title: title.trim(),
          notifBody: body.trim(),
          category,
          sendPush,
          sendFeed,
          targetPreferences: { category },
        },
      });

      if (error) throw error;
      
      toast.success(
        `Notification sent! ${sendPush ? `Push: ${data?.push?.sent || 0} delivered` : ""} ${sendFeed ? "Added to feed" : ""}`
      );
      setTitle("");
      setBody("");
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
        <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-display font-bold tracking-tight">Admin</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Shield size={48} className="text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-display font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  const formatDate = (ds: string) => {
    const d = new Date(ds);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <Bell size={18} className="text-primary" />
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Admin Notifications</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Compose */}
        <div className="ios-card p-4 space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <Send size={14} className="text-primary" />
            Compose Notification
          </h2>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title…"
              className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body (optional)…"
              className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              rows={4}
              maxLength={500}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Category (maps to user preferences)</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    category === key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery methods */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Delivery</label>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Push Notification</h3>
                <p className="text-[11px] text-muted-foreground">Send to all subscribed devices</p>
              </div>
              <Switch checked={sendPush} onCheckedChange={setSendPush} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">In-App Feed</h3>
                <p className="text-[11px] text-muted-foreground">Appears in users' My Feed tab</p>
              </div>
              <Switch checked={sendFeed} onCheckedChange={setSendFeed} />
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !title.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Sending…" : "Send Notification"}
          </button>
        </div>

        {/* History */}
        <div className="space-y-3">
          <h2 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <History size={14} className="text-muted-foreground" />
            Recent Notifications
          </h2>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No notifications sent yet</div>
          ) : (
            history.map((n) => (
              <div key={n.id} className="ios-card p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground truncate flex-1">{n.title}</h3>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{formatDate(n.created_at)}</span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                    {CATEGORIES.find(c => c.key === n.category)?.label || n.category}
                  </span>
                  {n.sent_push && <span className="text-[10px] text-primary font-medium">📱 Push</span>}
                  {n.sent_feed && <span className="text-[10px] text-primary font-medium">📰 Feed</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;
