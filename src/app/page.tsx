"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { Terminal, Zap, Shield, Map, Trophy, ChevronRight, Play } from "lucide-react";
import { DemoTerminal } from "@/components/DemoTerminal";
import { PROVIDERS } from "@/lib/providers";
import type { Provider } from "@/lib/providers";

const FEATURES = [
  {
    icon: Terminal,
    title: "Browser Terminal",
    description: "A full Terraform CLI simulator — run real commands and see realistic output without cloud credentials.",
    color: "#00ff9f",
  },
  {
    icon: Map,
    title: "Structured Missions",
    description: "15 operations across 5 chapters — from init to production hardening with lifecycle rules, workspaces, and secrets management.",
    color: "#7c5df9",
  },
  {
    icon: Zap,
    title: "XP & Leveling",
    description: "Earn credits for every completed objective. Rise from Terraform Rookie to IaC Architect.",
    color: "#c9a227",
  },
  {
    icon: Trophy,
    title: "20+ Badges",
    description: "Unlock rare and legendary badges for milestones, streaks, and mastery achievements — including a Production Ready legendary badge.",
    color: "#00c8ff",
  },
];

const QUOTES = [
  '"Infrastructure is code. Code is power."',
  '"Plan before you apply. Always."',
  '"State is memory. Guard it well."',
];

export default function LandingPage() {
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const initProfile = useGameStore((s) => s.initProfile);
  const resetProgress = useGameStore((s) => s.resetProgress);
  const [username, setUsername] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("aws");
  const [error, setError] = useState("");
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    setQuoteIdx(Math.floor(Math.random() * QUOTES.length));
  }, []);

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Agent codename must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 24) {
      setError("Agent codename must be under 24 characters.");
      return;
    }
    initProfile(trimmed, selectedProvider);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-noir-950 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,159,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,159,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-terminal/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-terminal/10 border border-terminal/30 flex items-center justify-center">
              <Terminal className="w-6 h-6 text-terminal" />
            </div>
            <span className="text-2xl font-bold font-mono text-terminal tracking-widest">TERRAOPS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-mono text-text-primary mb-4 leading-tight">
            Master <span className="text-terminal">Terraform</span>
            <br />
            One Mission at a Time
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto text-lg leading-relaxed mb-2">
            An interactive, gamified learning platform for Infrastructure as Code.
            Write real HCL. Run real commands. Level up for real.
          </p>
          <p className="text-text-muted font-mono text-sm italic">{QUOTES[quoteIdx]}</p>
        </div>

        {/* Hero: CTA + live demo terminal side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 items-center">
          {/* CTA card */}
          <div
            className="bg-noir-800 border border-noir-400 rounded-xl p-6"
            style={{ boxShadow: "0 0 40px rgba(0,255,159,0.06)" }}
          >
            {profile ? (
              <div className="text-center space-y-4">
                <div className="text-terminal font-mono text-sm">
                  Welcome back, <span className="font-bold">{profile.username}</span>
                </div>
                <div className="text-text-muted text-xs font-mono">
                  {profile.completedMissions.length} missions completed · {profile.xp} XP
                </div>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-terminal/10 border border-terminal/30 text-terminal font-mono font-bold text-sm hover:bg-terminal/20 transition-all"
                >
                  <Play className="w-4 h-4" />
                  Continue Mission
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Start fresh? All progress will be lost.")) resetProgress();
                  }}
                  className="text-xs text-text-muted hover:text-danger font-mono transition-colors"
                >
                  Start new profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleStart} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-text-muted mb-2 block tracking-widest">
                    AGENT CODENAME
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal/50 font-mono text-sm">❯</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      placeholder="enter your codename..."
                      className="w-full bg-noir-700 border border-noir-400 rounded-lg pl-8 pr-4 py-3 text-text-primary font-mono text-sm outline-none focus:border-terminal/50 transition-colors placeholder-text-muted"
                      autoFocus
                    />
                  </div>
                  {error && <p className="text-danger text-xs font-mono mt-1">{error}</p>}
                </div>

                {/* Provider selector */}
                <div>
                  <label className="text-xs font-mono text-text-muted mb-2 block tracking-widest">
                    CLOUD PROVIDER
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["aws", "gcp", "azure"] as Provider[]).map((p) => {
                      const cfg = PROVIDERS[p];
                      const active = selectedProvider === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedProvider(p)}
                          className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border font-mono text-xs transition-all"
                          style={{
                            borderColor: active ? cfg.color : "rgba(42,42,74,1)",
                            background: active ? cfg.bgColor : "rgba(13,13,24,0.8)",
                            color: active ? cfg.color : "#5a5a7a",
                          }}
                        >
                          <span className="font-bold text-sm">{cfg.shortName}</span>
                          <span className="text-[10px] opacity-70 truncate w-full text-center">{cfg.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-text-muted font-mono mt-1.5">
                    Missions adapt to your provider — switch any time in settings.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-terminal text-noir-950 font-mono font-bold text-sm hover:opacity-90 transition-all"
                >
                  <Shield className="w-4 h-4" />
                  Begin Operations
                  <ChevronRight className="w-4 h-4" />
                </button>
                <p className="text-center text-xs text-text-muted font-mono">
                  No account needed · Progress saved locally
                </p>
              </form>
            )}
          </div>

          {/* Live demo terminal */}
          <div>
            <div className="text-xs font-mono text-text-muted tracking-widest mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-terminal animate-pulse" />
              LIVE DEMO — OP-RESOURCE
            </div>
            <DemoTerminal />
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-noir-800 border border-noir-500 rounded-lg p-5 hover:border-noir-400 transition-colors">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}
              >
                <f.icon className="w-4 h-4" style={{ color: f.color }} />
              </div>
              <h3 className="font-mono font-bold text-sm text-text-primary mb-1">{f.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Curriculum preview */}
        <div className="bg-noir-800 border border-noir-500 rounded-xl p-6">
          <h2 className="font-mono font-bold text-sm text-text-secondary mb-4 tracking-widest">CURRICULUM OVERVIEW</h2>
          <div className="space-y-4">
            {[
              {
                chapter: "CH.1 — Foundation",
                color: "#9898c8",
                ops: [
                  ["OP-INIT",      "Initialize a Terraform working directory",            "100 XP"],
                  ["OP-RESOURCE",  "Deploy your first cloud resource",                    "150 XP"],
                ],
              },
              {
                chapter: "CH.2 — Field Operations",
                color: "#00c8ff",
                ops: [
                  ["OP-VARIABLES", "Variables, outputs, and best practices",              "200 XP"],
                  ["OP-STATE",     "State management and inspection",                     "250 XP"],
                  ["OP-DATA",      "Data sources and external queries",                   "300 XP"],
                ],
              },
              {
                chapter: "CH.3 — Advanced Tactics",
                color: "#00ff9f",
                ops: [
                  ["OP-MODULES",   "Reusable modules and the Registry",                  "400 XP"],
                  ["OP-REMOTE",    "Remote state and terraform_remote_state",             "500 XP"],
                ],
              },
              {
                chapter: "CH.4 — Expression Mastery",
                color: "#7c5df9",
                ops: [
                  ["OP-LOCALS",    "Locals block and computed values",                   "275 XP"],
                  ["OP-FOREACH",   "for_each and count meta-arguments",                  "375 XP"],
                  ["OP-FUNCTIONS", "Built-in functions and expressions",                 "425 XP"],
                ],
              },
              {
                chapter: "CH.5 — Production Hardening",
                color: "#c9a227",
                ops: [
                  ["OP-SECRETS",      "Sensitive variables and secret management",       "350 XP"],
                  ["OP-LIFECYCLE",    "lifecycle rules: zero-downtime deployments",      "450 XP"],
                  ["OP-CONDITIONALS", "Conditional expressions and for loops",           "425 XP"],
                  ["OP-WORKSPACE",    "Workspaces and environment isolation",            "400 XP"],
                  ["OP-VALIDATE",     "Input validation, fmt, and quality gates",        "325 XP"],
                ],
              },
            ].map(({ chapter, color, ops }) => (
              <div key={chapter}>
                <div
                  className="text-[10px] font-mono font-bold tracking-widest mb-1.5 pb-1 border-b"
                  style={{ color, borderColor: `${color}30` }}
                >
                  {chapter}
                </div>
                {ops.map(([code, desc, xp]) => (
                  <div key={code} className="flex items-center gap-3 text-xs py-0.5">
                    <span className="font-mono w-32 shrink-0" style={{ color: `${color}99` }}>{code}</span>
                    <span className="text-text-muted flex-1">{desc}</span>
                    <span className="text-gold shrink-0 font-mono">{xp}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
