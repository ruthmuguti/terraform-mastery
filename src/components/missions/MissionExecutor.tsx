"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import dynamic from "next/dynamic";
import type { Mission } from "@/lib/types";
import type { MissionProgress } from "@/lib/store";
import { useGameStore } from "@/lib/store";
import { executeCommand, createInitialState } from "@/lib/terraform-simulator";
import type { SimulatorState } from "@/lib/types";
import { TerminalWindow, type TerminalLine } from "@/components/terminal/TerminalWindow";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Circle, Lightbulb, BookOpen, ChevronRight,
  X, RotateCcw, FileCode, PanelLeftClose, PanelLeftOpen,
  Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBadge } from "@/data/badges";
import { registerHCL, defineNoirTheme } from "@/lib/hcl-language";
import { getStarterCode } from "@/data/missions";
import { PROVIDERS } from "@/lib/providers";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-noir-950 text-text-muted text-xs font-mono">
      Loading editor...
    </div>
  ),
});

interface MissionExecutorProps {
  mission: Mission;
  progress?: MissionProgress;
}

let lineCounter = 0;
function makeId() { return `line-${++lineCounter}`; }

function makeWelcomeLines(missionTitle: string): TerminalLine[] {
  return [
    { text: "TerraOps Secure Shell v1.0", type: "success", id: makeId() },
    { text: `Mission: ${missionTitle}`, type: "dim", id: makeId() },
    { text: "Tab to autocomplete · ↑↓ for history · type 'terraform' for help", type: "dim", id: makeId() },
    { text: "", type: "normal", id: makeId() },
  ];
}

export function MissionExecutor({ mission, progress }: MissionExecutorProps) {
  const router = useRouter();
  const completeMission = useGameStore((s) => s.completeMission);
  const updateMissionProgress = useGameStore((s) => s.updateMissionProgress);
  const incrementStats = useGameStore((s) => s.incrementStats);
  const provider = useGameStore((s) => s.profile?.provider ?? "aws");
  const providerConfig = PROVIDERS[provider];

  const starterCode = getStarterCode(mission, provider);
  const [hcl, setHcl] = useState(starterCode);
  const [simState, setSimState] = useState<SimulatorState>(createInitialState);
  const [termLines, setTermLines] = useState<TerminalLine[]>(() => makeWelcomeLines(mission.title));
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(
    new Set(progress?.completedObjectives ?? [])
  );
  // hintsRevealed[objId] = number of hints revealed for that objective
  const [hintsRevealed, setHintsRevealed] = useState<Record<string, number>>({});
  const [showConcepts, setShowConcepts] = useState(false);
  // AI tutor (Amazon Bedrock)
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorStreaming, setTutorStreaming] = useState(false);
  const [tutorText, setTutorText] = useState("");
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [completionResult, setCompletionResult] = useState<{
    xpGained: number; leveledUp: boolean; newTitle?: string; badgeName?: string;
  } | null>(null);
  const [xpPops, setXpPops] = useState<{ id: number; label: string }[]>([]);
  const alreadyCompletedRef = useRef(progress?.status === "completed");

  // Check objectives whenever sim state, HCL, or history changes
  useEffect(() => {
    const newCompleted = new Set(completedObjectives);
    let changed = false;
    for (const obj of mission.objectives) {
      if (!newCompleted.has(obj.id) && obj.check(simState, hcl, commandHistory, provider)) {
        newCompleted.add(obj.id);
        changed = true;
        setTermLines((prev) => [
          ...prev,
          { text: "", type: "normal", id: makeId() },
          { text: `✓ Objective complete: ${obj.description}`, type: "success", id: makeId() },
          { text: "", type: "normal", id: makeId() },
        ]);
        // Show floating XP pop
        const popId = Date.now() + Math.random();
        setXpPops((prev) => [...prev, { id: popId, label: "+progress" }]);
        setTimeout(() => setXpPops((prev) => prev.filter((p) => p.id !== popId)), 1500);
      }
    }
    if (changed) {
      setCompletedObjectives(newCompleted);
      updateMissionProgress(mission.id, {
        completedObjectives: Array.from(newCompleted),
        status: newCompleted.size === mission.objectives.length ? "completed" : "in_progress",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState, hcl, commandHistory]);

  // Award completion once all objectives done (but not if already completed on mount)
  useEffect(() => {
    if (
      completedObjectives.size === mission.objectives.length &&
      mission.objectives.length > 0 &&
      !completionResult &&
      !alreadyCompletedRef.current
    ) {
      const result = completeMission(mission.id, mission.xpReward, mission.badgeId);
      const badge = mission.badgeId ? getBadge(mission.badgeId) : undefined;
      setCompletionResult({ ...result, badgeName: badge?.name });
      // Big XP pop on completion
      const popId = Date.now();
      setXpPops((prev) => [...prev, { id: popId, label: `+${result.xpGained} XP` }]);
      setTimeout(() => setXpPops((prev) => prev.filter((p) => p.id !== popId)), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedObjectives.size]);

  const handleCommand = useCallback(
    (cmd: string) => {
      const inputLine: TerminalLine = { text: cmd, type: "input", id: makeId() };
      const output = executeCommand(cmd, simState, hcl);
      const newHistory = [...commandHistory, cmd];
      setCommandHistory(newHistory);
      setSimState(output.newState);
      setTermLines((prev) => [
        ...prev,
        inputLine,
        ...output.lines.map((l) => ({ ...l, id: makeId() })),
      ]);
      incrementStats({ totalCommands: 1 });
      if (cmd.startsWith("terraform apply")) incrementStats({ terraformApplies: 1 });
    },
    [simState, hcl, commandHistory, incrementStats]
  );

  const resetTerminal = useCallback(() => {
    setSimState(createInitialState());
    setCommandHistory([]);
    setTermLines(makeWelcomeLines(mission.title));
  }, [mission.title]);

  const resetCode = useCallback(() => {
    setHcl(starterCode);
  }, [starterCode]);

  const revealNextHint = (objId: string) => {
    setHintsRevealed((prev) => {
      const current = prev[objId] ?? 0;
      const obj = mission.objectives.find((o) => o.id === objId);
      if (!obj || current >= obj.hints.length) return prev;
      incrementStats({ hintsUsed: 1 });
      return { ...prev, [objId]: current + 1 };
    });
  };

  const nextObjective = mission.objectives.find((o) => !completedObjectives.has(o.id));
  const allDone = completedObjectives.size === mission.objectives.length;

  // Recent error lines from the terminal, used to ground the tutor.
  const recentErrorLines = termLines
    .filter((l) => l.type === "error")
    .slice(-20)
    .map((l) => l.text);

  const askTutor = useCallback(async () => {
    if (tutorStreaming) return;
    setTutorOpen(true);
    setTutorError(null);
    setTutorText("");
    setTutorStreaming(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionTitle: mission.title,
          objective: (nextObjective ?? mission.objectives[0])?.description,
          provider,
          hcl,
          lastCommand: commandHistory[commandHistory.length - 1],
          errorLines: termLines.filter((l) => l.type === "error").slice(-20).map((l) => l.text),
          question: tutorQuestion.trim() || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "The tutor is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setTutorText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setTutorError(err instanceof Error ? err.message : "The tutor is unavailable right now.");
    } finally {
      setTutorStreaming(false);
    }
  }, [
    tutorStreaming, mission.title, mission.objectives, nextObjective,
    provider, hcl, commandHistory, termLines, tutorQuestion,
  ]);

  // ── Resizable panels ──────────────────────────────────────────────────────
  const DEFAULT_SIDEBAR_W = 288; // px
  const DEFAULT_EDITOR_W  = 320; // px
  const MIN_W = 180;
  const MAX_SIDEBAR_W = 480;
  const MAX_EDITOR_W  = 600;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const [editorWidth,  setEditorWidth]  = useState(DEFAULT_EDITOR_W);
  const dragState = useRef<{
    panel: "sidebar" | "editor";
    startX: number;
    startW: number;
  } | null>(null);

  useLayoutEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      if (dragState.current.panel === "sidebar") {
        setSidebarWidth(Math.max(MIN_W, Math.min(MAX_SIDEBAR_W, dragState.current.startW + delta)));
      } else {
        setEditorWidth(Math.max(MIN_W, Math.min(MAX_EDITOR_W, dragState.current.startW + delta)));
      }
    };
    const onMouseUp = () => { dragState.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  const startDrag = (panel: "sidebar" | "editor") => (e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = {
      panel,
      startX: e.clientX,
      startW: panel === "sidebar" ? sidebarWidth : editorWidth,
    };
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Completion banner */}
      {completionResult && (
        <div
          className="mx-5 mt-3 rounded-lg border border-terminal/30 bg-terminal/5 px-4 py-3 flex items-center gap-4"
          style={{ boxShadow: "0 0 24px rgba(0,255,159,0.08)" }}
        >
          <span className="text-xl shrink-0">🎉</span>
          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-terminal text-sm">Operation Complete!</div>
            <div className="text-xs font-mono text-text-secondary mt-0.5 flex flex-wrap gap-3">
              <span className="text-gold">+{completionResult.xpGained} XP earned</span>
              {completionResult.badgeName && <span className="text-purple">🏅 {completionResult.badgeName}</span>}
              {completionResult.leveledUp && <span className="text-info">⬆ Level up → {completionResult.newTitle}</span>}
            </div>
          </div>
          <button
            onClick={() => router.push("/missions")}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded bg-terminal/10 border border-terminal/20 text-terminal hover:bg-terminal/20 transition-all shrink-0"
          >
            Next Mission <ChevronRight className="w-3 h-3" />
          </button>
          <button onClick={() => setCompletionResult(null)} className="text-text-muted hover:text-text-primary shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar: objectives + concepts */}
        <div
          className={cn(
            "flex flex-col border-r border-noir-500 overflow-hidden shrink-0",
            sidebarCollapsed ? "transition-all duration-200" : ""
          )}
          style={{ width: sidebarCollapsed ? 40 : sidebarWidth }}
        >
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex items-center justify-center h-full text-text-muted hover:text-terminal transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-noir-500 shrink-0">
                <span className="text-xs font-mono text-text-muted tracking-widest">MISSION BRIEF</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      color: providerConfig.color,
                      borderColor: providerConfig.borderColor,
                      background: providerConfig.bgColor,
                    }}
                  >
                    {providerConfig.shortName}
                  </span>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Briefing */}
              <div className="p-4 border-b border-noir-500">
                <p className="text-xs text-text-secondary leading-relaxed">{mission.briefing}</p>
              </div>

              {/* Objectives */}
              <div className="p-4 border-b border-noir-500 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-text-muted tracking-widest">OBJECTIVES</span>
                  <div
                    className="ml-auto text-xs font-mono px-1.5 py-0.5 rounded"
                    style={
                      allDone
                        ? { color: "#00ff9f", background: "rgba(0,255,159,0.1)" }
                        : { color: "#9898b8", background: "rgba(30,30,56,0.8)" }
                    }
                  >
                    {completedObjectives.size}/{mission.objectives.length}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {mission.objectives.map((obj) => {
                    const done = completedObjectives.has(obj.id);
                    const isNext = nextObjective?.id === obj.id;
                    const revealed = hintsRevealed[obj.id] ?? 0;
                    const hasMoreHints = revealed < obj.hints.length;
                    return (
                      <div
                        key={obj.id}
                        className={cn(
                          "rounded-lg p-2.5 border text-xs transition-all",
                          done
                            ? "border-terminal/15 bg-terminal/5"
                            : isNext
                            ? "border-purple/30 bg-purple/5"
                            : "border-noir-500 bg-noir-800/50"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-terminal shrink-0 mt-0.5" />
                          ) : (
                            <Circle
                              className="w-3.5 h-3.5 shrink-0 mt-0.5"
                              style={{ color: isNext ? "#7c5df9" : "#5a5a7a" }}
                            />
                          )}
                          <span
                            className={cn(
                              "font-mono leading-relaxed",
                              done ? "text-terminal/50 line-through" : isNext ? "text-text-primary" : "text-text-muted"
                            )}
                          >
                            {obj.description}
                          </span>
                        </div>

                        {/* Tiered hints — show for any incomplete objective */}
                        {!done && obj.hints.length > 0 && (
                          <div className="mt-2 ml-5 space-y-1.5">
                            {/* Already-revealed hints */}
                            {Array.from({ length: revealed }).map((_, i) => (
                              <div
                                key={i}
                                className="text-gold font-mono text-xs bg-gold/5 border border-gold/15 rounded px-2 py-1.5 leading-relaxed"
                              >
                                💡 {obj.hints[i]}
                              </div>
                            ))}
                            {/* Reveal next hint button */}
                            {hasMoreHints && (
                              <button
                                onClick={() => revealNextHint(obj.id)}
                                className="flex items-center gap-1 text-text-muted hover:text-gold transition-colors text-xs font-mono"
                              >
                                <Lightbulb className="w-3 h-3" />
                                {revealed === 0 ? "show hint" : `hint ${revealed + 1} of ${obj.hints.length}`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Tutor (Amazon Bedrock) */}
              {!allDone && (
                <div className="p-4 border-b border-noir-500 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-text-muted tracking-widest">AI TUTOR</span>
                    <span className="ml-auto text-[10px] font-mono text-purple/60 px-1.5 py-0.5 rounded bg-purple/5 border border-purple/15">
                      Bedrock
                    </span>
                  </div>
                  {recentErrorLines.length > 0 && !tutorOpen && (
                    <p className="text-[11px] text-text-muted leading-relaxed mb-2">
                      Hit an error? Ask the tutor why.
                    </p>
                  )}
                  <input
                    type="text"
                    value={tutorQuestion}
                    onChange={(e) => setTutorQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") askTutor(); }}
                    maxLength={500}
                    placeholder="Ask about this mission… (optional)"
                    className="w-full text-xs font-mono bg-noir-900 border border-noir-500 rounded px-2 py-1.5 text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-purple/40 mb-2"
                  />
                  <button
                    onClick={askTutor}
                    disabled={tutorStreaming}
                    className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded bg-purple/10 border border-purple/25 text-purple hover:bg-purple/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                  >
                    {tutorStreaming ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> Ask the tutor</>
                    )}
                  </button>

                  {tutorOpen && (tutorText || tutorError || tutorStreaming) && (
                    <div
                      aria-live="polite"
                      className="mt-2 rounded-lg border border-purple/20 bg-purple/5 px-2.5 py-2"
                    >
                      {tutorError ? (
                        <p className="text-xs font-mono text-warning leading-relaxed">
                          {tutorError} You can still use the hints below.
                        </p>
                      ) : (
                        <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                          {tutorText}
                          {tutorStreaming && <span className="inline-block w-1.5 h-3 bg-purple/60 ml-0.5 animate-pulse align-middle" />}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Concepts (collapsible) */}
              <div className="p-4 shrink-0">
                <button
                  className="flex items-center gap-2 text-xs font-mono text-text-muted w-full hover:text-text-primary transition-colors mb-2"
                  onClick={() => setShowConcepts((v) => !v)}
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="tracking-widest">KEY CONCEPTS</span>
                  <ChevronRight className={cn("w-3 h-3 ml-auto transition-transform", showConcepts && "rotate-90")} />
                </button>
                {showConcepts && (
                  <ul className="space-y-2 mt-1">
                    {mission.concepts.map((c, i) => (
                      <li key={i} className="text-xs text-text-secondary leading-relaxed flex gap-2">
                        <span className="text-terminal/40 shrink-0 mt-0.5">▸</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drag handle: sidebar ↔ editor */}
        {!sidebarCollapsed && (
          <div
            className="w-1 shrink-0 cursor-col-resize bg-noir-500 hover:bg-terminal/50 active:bg-terminal transition-colors group relative"
            onMouseDown={startDrag("sidebar")}
            onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_W)}
            title="Drag to resize · Double-click to reset"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Center: HCL Editor */}
        <div className="shrink-0 flex flex-col" style={{ width: editorWidth }}>
          <div className="flex items-center gap-2 px-3 py-2 bg-noir-800 border-b border-noir-500 shrink-0">
            <div className="w-2 h-2 rounded-full bg-terminal/60" />
            <span className="text-xs font-mono text-text-muted">main.tf</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={resetCode}
                title="Restore starter code"
                className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text-primary px-1.5 py-1 rounded hover:bg-noir-600 transition-colors"
              >
                <FileCode className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              height="100%"
              language="hcl"
              value={hcl}
              onChange={(v) => setHcl(v ?? "")}
              options={{
                fontSize: 13,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                minimap: { enabled: false },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: "line",
                cursorBlinking: "smooth",
                tabSize: 2,
              }}
              beforeMount={(monaco) => {
                registerHCL(monaco);
                defineNoirTheme(monaco);
                monaco.editor.setTheme("noir");
              }}
            />
          </div>
        </div>

        {/* Drag handle: editor ↔ terminal */}
        <div
          className="w-1 shrink-0 cursor-col-resize bg-noir-500 hover:bg-terminal/50 active:bg-terminal transition-colors relative"
          onMouseDown={startDrag("editor")}
          onDoubleClick={() => setEditorWidth(DEFAULT_EDITOR_W)}
          title="Drag to resize · Double-click to reset"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right: Terminal */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-noir-800 border-b border-noir-500 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-danger/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-terminal/60" />
            </div>
            <span className="text-xs font-mono text-text-muted ml-1">agent@terraops:~/workspace</span>
            <div className="ml-auto flex items-center gap-1">
              {simState.applied && (
                <span className="text-xs font-mono text-terminal/60 px-1.5 py-0.5 rounded bg-terminal/5 border border-terminal/15">
                  APPLIED
                </span>
              )}
              {simState.initialized && !simState.applied && (
                <span className="text-xs font-mono text-info/60 px-1.5 py-0.5 rounded bg-info/5 border border-info/15">
                  INITIALIZED
                </span>
              )}
              <button
                onClick={resetTerminal}
                title="Reset terminal"
                className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text-primary px-1.5 py-1 rounded hover:bg-noir-600 transition-colors ml-1"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TerminalWindow output={termLines} onCommand={handleCommand} />
          </div>
        </div>
      </div>

      {/* Floating XP pops */}
      <div className="pointer-events-none fixed bottom-24 right-8 flex flex-col-reverse gap-2 z-50">
        {xpPops.map((pop) => (
          <div
            key={pop.id}
            className="font-mono font-bold text-sm text-terminal px-3 py-1.5 rounded-lg border border-terminal/30 bg-noir-900/90 backdrop-blur-sm"
            style={{
              animation: "xpFloat 1.5s ease-out forwards",
              boxShadow: "0 0 16px rgba(0,255,159,0.25)",
            }}
          >
            {pop.label}
          </div>
        ))}
      </div>
    </div>
  );
}
