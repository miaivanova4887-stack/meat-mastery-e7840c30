import { useState, useEffect, useCallback, useRef } from "react";
import { Sun, Play, Pause, SkipForward, RotateCcw, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

const POSES = [
  { key: 1, duration: 60, sides: 1 },
  { key: 2, duration: 60, sides: 1 },
  { key: 3, duration: 45, sides: 1 },
  { key: 4, duration: 45, sides: 2 },
  { key: 5, duration: 60, sides: 1 },
  { key: 6, duration: 45, sides: 2 },
  { key: 7, duration: 120, sides: 1 },
];

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const YogaFlowProgram = () => {
  const { t, i18n } = useTranslation();

  const [active, setActive] = useState(false);
  const [poseIndex, setPoseIndex] = useState(0);
  const [sideIndex, setSideIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(POSES[0].duration);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [muted, setMuted] = useState(false);
  const advancingRef = useRef(false);
  const mutedRef = useRef(false);

  // Keep ref in sync so callbacks always see latest muted state
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const ttsLang = i18n.language === "fr" ? "fr-FR" : "en-US";

  const speak = useCallback(async (text: string) => {
    if (mutedRef.current || !text) return;
    try {
      await TextToSpeech.stop();
      await TextToSpeech.speak({ text, lang: ttsLang });
    } catch {
      // Fail silently on web / unsupported devices
    }
  }, [ttsLang]);

  const currentPose = POSES[poseIndex];

  const advanceToNext = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    if (currentPose.sides === 2 && sideIndex === 0) {
      setSideIndex(1);
      setTimeLeft(currentPose.duration);
    } else if (poseIndex < POSES.length - 1) {
      const next = poseIndex + 1;
      setPoseIndex(next);
      setSideIndex(0);
      setTimeLeft(POSES[next].duration);
    } else {
      setCompleted(true);
    }

    setTimeout(() => { advancingRef.current = false; }, 50);
  }, [poseIndex, sideIndex, currentPose]);

  // TTS on pose/side transitions
  useEffect(() => {
    if (!active || completed) return;

    const poseName = t(`exercise.yoga_flow.pose_${poseIndex + 1}_name`, `Pose ${poseIndex + 1}`);
    const poseDesc = t(`exercise.yoga_flow.pose_${poseIndex + 1}_desc`, "");

    if (currentPose.sides === 2) {
      const sideLabel = sideIndex === 0
        ? t("exercise.yoga_flow.left_side", "Left Side")
        : t("exercise.yoga_flow.right_side", "Right Side");
      if (sideIndex === 0) {
        // New 2-sided pose: name + desc + side
        speak(`${poseName}. ${poseDesc}. ${sideLabel}`);
      } else {
        // Switching to right side
        speak(sideLabel);
      }
    } else {
      speak(`${poseName}. ${poseDesc}`);
    }
  }, [active, poseIndex, sideIndex, completed]); // eslint-disable-line react-hooks/exhaustive-deps

  // TTS on completion
  useEffect(() => {
    if (completed) {
      const completeTitle = t("exercise.yoga_flow.complete_title", "Flow Complete");
      speak(completeTitle);
    }
  }, [completed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || paused || completed) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          advanceToNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, paused, completed, advanceToNext]);

  const startFlow = () => {
    setActive(true);
    setPoseIndex(0);
    setSideIndex(0);
    setTimeLeft(POSES[0].duration);
    setPaused(false);
    setCompleted(false);
  };

  const restart = () => {
    startFlow();
  };

  const poseKey = (i: number) => `exercise.yoga_flow.pose_${i}_name`;
  const poseDescKey = (i: number) => `exercise.yoga_flow.pose_${i}_desc`;

  // Idle card
  if (!active) {
    return (
      <div
        className="bg-card border border-border rounded-lg p-4 mb-3 animate-fade-in-up"
        style={{ animationDelay: "0.24s" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sun size={20} className="text-primary" />
          <h3 className="font-display font-bold text-foreground">
            {t("exercise.yoga_flow.name", "Yoga Flow")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("exercise.yoga_flow.desc", "A 7-pose guided recovery flow to restore flexibility and calm your nervous system.")}
        </p>
        <ul className="space-y-1.5 mb-3">
          {POSES.map((_, i) => (
            <li key={i} className="text-xs text-secondary-foreground/80 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
              {t(poseKey(i + 1), `Pose ${i + 1}`)}
            </li>
          ))}
        </ul>
        <Button size="sm" className="gap-1.5" onClick={startFlow}>
          {t("exercise.yoga_flow.start", "Start Flow")} <ChevronRight size={14} />
        </Button>
      </div>
    );
  }

  // Completed
  if (completed) {
    return (
      <div
        className="bg-card border border-primary/30 rounded-lg p-4 mb-3 animate-fade-in-up"
        style={{ animationDelay: "0.24s" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sun size={20} className="text-primary" />
          <h3 className="font-display font-bold text-foreground">
            {t("exercise.yoga_flow.complete_title", "Flow Complete")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("exercise.yoga_flow.complete_desc", "Great work! Namaste.")}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={restart}>
            <RotateCcw size={14} /> {t("exercise.yoga_flow.restart", "Restart")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setActive(false)}>
            {t("exercise.yoga_flow.close", "Close")}
          </Button>
        </div>
      </div>
    );
  }

  // Active flow
  const progressPercent = ((poseIndex + (currentPose.sides === 2 && sideIndex === 1 ? 0.5 : 0)) / POSES.length) * 100;
  const timerPercent = (timeLeft / currentPose.duration) * 100;

  return (
    <div
      className="bg-card border border-primary/30 rounded-lg p-4 mb-3 animate-fade-in-up"
      style={{ animationDelay: "0.24s" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">
            {t("exercise.yoga_flow.pose_of", "Pose {{current}} of {{total}}")
              .replace("{{current}}", String(poseIndex + 1))
              .replace("{{total}}", String(POSES.length))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted((m) => !m)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            onClick={() => setActive(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <Progress value={progressPercent} className="h-1.5 mb-4" />

      {/* Pose info */}
      <div className="text-center space-y-2 mb-4">
        <h3 className="font-display font-bold text-foreground text-base">
          {t(poseKey(poseIndex + 1), `Pose ${poseIndex + 1}`)}
        </h3>
        {currentPose.sides === 2 && (
          <span className="inline-block text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {sideIndex === 0
              ? t("exercise.yoga_flow.left_side", "Left Side")
              : t("exercise.yoga_flow.right_side", "Right Side")}
          </span>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(poseDescKey(poseIndex + 1), "")}
        </p>
      </div>

      {/* Timer */}
      <div className="text-center mb-4">
        <span className="text-3xl font-mono font-bold text-foreground">{formatTime(timeLeft)}</span>
        <Progress value={timerPercent} className="h-1 mt-2" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused
            ? t("exercise.yoga_flow.resume", "Resume")
            : t("exercise.yoga_flow.pause", "Pause")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={advanceToNext}
        >
          <SkipForward size={14} /> {t("exercise.yoga_flow.skip", "Skip")}
        </Button>
      </div>
    </div>
  );
};

export default YogaFlowProgram;
