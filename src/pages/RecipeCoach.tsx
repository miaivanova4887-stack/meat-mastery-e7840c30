import { ArrowLeft, Send, User, Loader2, ThumbsUp, ThumbsDown, ChefHat, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useUserProfile } from "@/contexts/UserProfileContext";
import ReactMarkdown from "react-markdown";
import TeaserGate from "@/components/TeaserGate";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-coach`;

const STARTERS = [
  "🥩 Quick lunch ideas for today",
  "🔥 High-protein dinner under 30 min",
  "🍳 Easy breakfast recipes",
  "💪 Post-workout meal suggestions",
];

const RecipeCoach = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const { hasAccess, refreshSubscription } = useSubscription();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const assistantStartRef = useRef<HTMLDivElement>(null);

  // Scroll to the START of the latest assistant response when streaming begins
  const scrollToAssistantStart = useCallback(() => {
    setTimeout(() => {
      assistantStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  const dietTier = (() => {
    const raw = localStorage.getItem("carnivore-onboarding-answers");
    if (!raw) return "strict";
    return "strict";
  })();

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Get the current session JWT — the edge function's requireTier helper
    // validates this token via supabase.auth.getUser(). Sending the anon
    // publishable key (the previous behavior) made every authenticated
    // call return 401, blocking Pro/Elite users from the AI Coach.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast.error("Please sign in again to use the AI Coach.");
      return;
    }

    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    let scrolledToStart = false;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          profile: {
            dietTier,
            goal: profile.goal,
            activityLevel: profile.activityLevel,
            struggles: profile.struggles,
            weight: profile.body.weight,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as { error?: string }));
        let userMessage: string;
        switch (resp.status) {
          case 401:
            userMessage = "Your session expired. Please sign in again.";
            break;
          case 403:
            userMessage = "AI Coach requires a Pro or Elite subscription.";
            // Refresh in case the client cache is stale.
            void refreshSubscription();
            break;
          case 402:
            userMessage = err.error || "AI credits exhausted. Please try again later.";
            break;
          case 429:
            userMessage = err.error || "Too many requests. Please wait a moment.";
            break;
          default:
            userMessage = err.error || `Request failed (${resp.status}).`;
        }
        toast.error(userMessage);
        throw new Error(userMessage);
      }

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
              // Scroll to start of assistant response once
              if (!scrolledToStart) {
                scrolledToStart = true;
                scrollToAssistantStart();
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't reach the coach: ${(e as Error).message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleFeedback = (idx: number, type: "up" | "down") => {
    setFeedback((prev) => ({ ...prev, [idx]: prev[idx] === type ? undefined! : type }));
  };

  // Find last assistant message index for scroll ref
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === "assistant" ? i : acc), -1);

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex-shrink-0 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3 z-40" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center shadow-md ring-1 ring-primary/20">
            <ChefHat size={16} className="text-primary-foreground drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold tracking-tight">Recipe Coach</h1>
            <p className="text-[10px] text-muted-foreground">AI-powered meal suggestions</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 mx-auto w-full max-w-3xl lg:max-w-4xl">
        {!hasAccess("pro") ? (
          <div className="flex flex-col items-center justify-center h-full pb-8">
            <TeaserGate requiredTier="pro" featureName="AI Carnivore Coach" mode="block">
              <div />
            </TeaserGate>
          </div>
        ) : messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <UtensilsCrossed size={28} className="text-primary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="font-display font-bold text-foreground text-lg">Your Carnivore Coach</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
                Ask me for recipes, meal plans, or cooking tips tailored to your diet.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="ios-card p-3 text-left text-xs text-foreground hover:bg-secondary/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasAccess("pro") && messages.map((msg, i) => {
          const isLastAssistant = i === lastAssistantIdx;
          return (
            <div key={i}>
              {/* Scroll anchor for last assistant message */}
              {msg.role === "assistant" && isLastAssistant && <div ref={assistantStartRef} />}
              <div className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <ChefHat size={13} className="text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border/40 text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>h3]:mt-3 [&>h3]:mb-1 [&>h3]:text-sm">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={14} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              {/* Feedback buttons for assistant messages */}
              {msg.role === "assistant" && !isLoading && (
                <div className="flex gap-1 ml-9 mt-1">
                  <button
                    onClick={() => handleFeedback(i, "up")}
                    className={`p-1.5 rounded-lg transition-all ${feedback[i] === "up" ? "bg-green-500/10 text-green-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    onClick={() => handleFeedback(i, "down")}
                    className={`p-1.5 rounded-lg transition-all ${feedback[i] === "down" ? "bg-red-500/10 text-red-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                  >
                    <ThumbsDown size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ChefHat size={13} className="text-primary-foreground" />
            </div>
            <div className="bg-card border border-border/40 rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/*
       * Input bar. We disable it entirely when the user lacks Pro access
       * because the messages pane already shows a block-mode TeaserGate
       * (lines above) and previously a free user could still type into
       * the textarea and call the `recipe-coach` edge function directly,
       * burning through the workspace's AI quota with no upgrade prompt.
       * The visible paywall in the message list plus a disabled composer
       * mirrors the rest of the app's paywall pattern (Progress, MealPlan).
       *
       * NOTE: the `recipe-coach` Supabase Edge Function currently does
       * NOT re-check subscription tier server-side. Anyone who bypasses
       * the client gate (e.g. by calling the function directly with a
       * valid auth token) can still hit it. Server-side JWT + tier check
       * should be added in a follow-up change.
       */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 border-t border-border/40 bg-card/80 ios-blur px-4 py-3 safe-area-bottom"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasAccess("pro") ? "Ask for recipes, meal ideas…" : "Unlock with Pro to chat with your coach"}
            rows={1}
            disabled={!hasAccess("pro")}
            className="flex-1 resize-none bg-secondary rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-32 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minHeight: "40px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !hasAccess("pro")}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecipeCoach;
