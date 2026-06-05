import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ExternalLink, Download } from "lucide-react";
import CoachingBooking from "@/components/CoachingBooking";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { toast } from "sonner";

interface CoachingSession {
  id: string;
  status: string;
  scheduled_at: string | null;
  booking_url: string | null;
  attendee_email: string | null;
  attendee_name: string | null;
  timezone: string | null;
  session_month: string;
  created_at: string;
  external_booking_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatWhen(iso: string | null, tz?: string | null) {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
      timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function buildIcs(s: CoachingSession): string {
  if (!s.scheduled_at) return "";
  const start = new Date(s.scheduled_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${s.id}@carnivorex.app`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CarnivoreX//Coaching//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    "SUMMARY:CarnivoreX Coaching Call",
    "DESCRIPTION:Your 1-hour coaching session with CarnivoreX.",
    s.booking_url ? `URL:${s.booking_url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadIcs(session: CoachingSession) {
  const ics = buildIcs(session);
  if (!ics) return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `coaching-${session.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CoachingSessionsList() {
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTz, setUserTz] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const [{ data: rows }, { data: profile }] = await Promise.all([
      supabase
        .from("coaching_sessions")
        .select(
          "id, status, scheduled_at, booking_url, attendee_email, attendee_name, timezone, session_month, created_at, external_booking_id"
        )
        .eq("user_id", uid)
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("timezone").eq("id", uid).maybeSingle(),
    ]);
    setSessions((rows as CoachingSession[]) || []);
    setUserTz(profile?.timezone || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
    const onFocus = () => fetchSessions();
    const onBooked = () => fetchSessions();
    window.addEventListener("focus", onFocus);
    window.addEventListener("coaching-booked", onBooked);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("coaching-booked", onBooked);
    };
  }, [fetchSessions]);

  const now = Date.now();
  const visible = sessions.filter((s) => s.status !== "pending");
  const upcoming = visible.filter(
    (s) =>
      s.status === "scheduled" &&
      s.scheduled_at &&
      new Date(s.scheduled_at).getTime() > now
  );
  const past = visible
    .filter(
      (s) =>
        s.status === "completed" ||
        s.status === "cancelled" ||
        (s.status === "scheduled" &&
          s.scheduled_at &&
          new Date(s.scheduled_at).getTime() <= now)
    )
    .sort((a, b) => {
      const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return tb - ta;
    });

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="ios-card p-4 h-20 animate-pulse bg-muted/30"
          />
        ))}
      </div>
    );
  }

  const isEmpty = upcoming.length === 0 && past.length === 0;

  if (isEmpty) {
    return (
      <>
        <div className="ios-card p-5 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <h4 className="font-display font-bold text-foreground text-[15px]">
            No coaching sessions yet
          </h4>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Book a 1-hour coaching call to get personalized guidance.
          </p>
          <Button size="sm" onClick={() => setBookingOpen(true)}>
            Book a call
          </Button>
        </div>
        <CoachingBooking open={bookingOpen} onOpenChange={setBookingOpen} />
      </>
    );
  }

  const renderCard = (s: CoachingSession, kind: "upcoming" | "past") => {
    const tz = s.timezone || userTz;
    const statusLabel = STATUS_LABEL[s.status] || s.status;
    const pillTone =
      s.status === "cancelled"
        ? "bg-muted text-muted-foreground"
        : s.status === "completed"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/15 text-primary";
    return (
      <div key={s.id} className="ios-card p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-display font-bold text-foreground text-[15px]">
              1-hour coaching call
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{formatWhen(s.scheduled_at, tz)}</span>
            </div>
          </div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${pillTone}`}
          >
            {statusLabel}
          </span>
        </div>

        {kind === "upcoming" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {s.scheduled_at && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadIcs(s)}
                className="h-8 text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Add to calendar
              </Button>
            )}
            {s.booking_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-8 text-xs"
              >
                <a
                  href={s.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Reschedule
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-display font-bold text-foreground">
            {upcoming.length === 1 ? "Upcoming session" : "Upcoming sessions"}
          </h3>
          <div className="space-y-2">
            {upcoming.map((s) => renderCard(s, "upcoming"))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-display font-bold text-foreground">
            Past sessions
          </h3>
          <div className="space-y-2">
            {past.map((s) => renderCard(s, "past"))}
          </div>
        </div>
      )}
    </div>
  );
}
