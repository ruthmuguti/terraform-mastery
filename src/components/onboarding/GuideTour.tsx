"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Radio, Sparkles, X } from "lucide-react";

interface TourStep {
  /** CSS selector for the element to spotlight. Omit for a centered, anchor-less step. */
  selector?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to the field, Agent.",
    body: "TerraOps is your training ground for Terraform. Real HCL, real commands, zero cloud bill. Here's a 20-second briefing on your gear — hit Skip any time.",
  },
  {
    selector: '[data-tour="nav"]',
    title: "Your case files",
    body: "Missions are your operations. Achievements track the badges you earn, and the Leaderboard shows the top agents. Dashboard is home base.",
  },
  {
    selector: '[data-tour="agent"]',
    title: "Your rank",
    body: "XP and rank live here. Close operations to level up — Rookie all the way to IaC Architect.",
  },
  {
    selector: '[data-tour="next-op"]',
    title: "Start here",
    body: "Your next operation. Open it to get a brief, write HCL in the editor, and run terraform in a simulated shell.",
  },
  {
    title: "Your AI handler is standing by",
    body: "Inside a mission: ask FIELD INTEL when you're stuck, DRAFT BLUEPRINT to scaffold HCL from a plain-English description, and request a FIELD DEBRIEF after you pass. All powered by Amazon Bedrock. Good hunting.",
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

interface GuideTourProps {
  /** Called when the tour is finished or skipped. */
  onClose: () => void;
}

export function GuideTour({ onClose }: GuideTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = useCallback(() => onClose(), [onClose]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [isLast, finish]);

  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  // Measure the current target. If it's missing or hidden, treat as a centered step.
  useLayoutEffect(() => {
    function measure() {
      if (!current.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(current.selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setRect(null); // e.g. collapsed sidebar — fall back to centered
        return;
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current.selector, step]);

  // Keyboard controls + focus the card for a11y.
  useEffect(() => {
    cardRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, next, back]);

  const pad = 8;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Place the caption card: below the target if room, otherwise above; centered if anchor-less.
  let cardStyle: React.CSSProperties;
  if (spotlight) {
    const belowTop = spotlight.top + spotlight.height + 12;
    const placeBelow = belowTop + 180 < window.innerHeight;
    cardStyle = {
      position: "fixed",
      top: placeBelow ? belowTop : undefined,
      bottom: placeBelow ? undefined : window.innerHeight - spotlight.top + 12,
      left: Math.max(12, Math.min(spotlight.left, window.innerWidth - 360)),
      width: 340,
    };
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 360,
    };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Dimmed backdrop. Clicking it skips (common tour convention). */}
      <div
        className="absolute inset-0 bg-noir-950/80 motion-safe:transition-opacity"
        onClick={finish}
      />

      {/* Spotlight cutout over the current target */}
      {spotlight && (
        <div
          className="absolute rounded-lg pointer-events-none motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(5,5,12,0.80)",
            border: "1px solid rgba(124,93,249,0.6)",
          }}
        />
      )}

      {/* Caption card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        style={cardStyle}
        className="rounded-xl border border-purple/30 bg-noir-800 p-4 shadow-2xl outline-none"
      >
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-3.5 h-3.5 text-purple" />
          <span className="text-[11px] font-mono text-purple tracking-widest">HANDLER</span>
          <span className="ml-auto text-[10px] font-mono text-text-muted">
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="text-text-muted hover:text-text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <h3 className="font-mono font-bold text-sm text-text-primary mb-1 flex items-center gap-1.5">
          {isLast && <Sparkles className="w-3.5 h-3.5 text-purple" />}
          {current.title}
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-3">{current.body}</p>

        <div className="flex items-center gap-2">
          <button
            onClick={finish}
            className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
          >
            Skip
          </button>
          <div className="ml-auto flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={back}
                className="text-xs font-mono px-2.5 py-1.5 rounded border border-noir-500 text-text-secondary hover:text-text-primary hover:border-noir-400 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="text-xs font-mono px-3 py-1.5 rounded bg-purple/15 border border-purple/30 text-purple hover:bg-purple/25 transition-colors"
            >
              {isLast ? "Start operations" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
