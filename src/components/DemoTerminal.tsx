"use client";

import { useEffect, useState, useRef } from "react";

const DEMO_SCRIPT = [
  { delay: 400,  type: "cmd",  text: "terraform init" },
  { delay: 800,  type: "out",  text: "Initializing the backend..." },
  { delay: 300,  type: "out",  text: "Initializing provider plugins..." },
  { delay: 400,  type: "out",  text: "- Installing hashicorp/aws v5.72.1...", color: "#5a5a7a" },
  { delay: 600,  type: "out",  text: "✓ Terraform has been successfully initialized!", color: "#00ff9f" },
  { delay: 700,  type: "cmd",  text: "terraform plan" },
  { delay: 500,  type: "out",  text: "Terraform will perform the following actions:", color: "#e2e2f0" },
  { delay: 200,  type: "out",  text: "  + resource \"aws_s3_bucket\" \"mission_bucket\" {", color: "#00ff9f" },
  { delay: 150,  type: "out",  text: "      + bucket = \"my-terraform-ops-bucket\"", color: "#00ff9f" },
  { delay: 150,  type: "out",  text: "    }", color: "#00ff9f" },
  { delay: 300,  type: "out",  text: "Plan: 1 to add, 0 to change, 0 to destroy.", color: "#e2e2f0" },
  { delay: 700,  type: "cmd",  text: "terraform apply -auto-approve" },
  { delay: 400,  type: "out",  text: "aws_s3_bucket.mission_bucket: Creating..." },
  { delay: 800,  type: "out",  text: "aws_s3_bucket.mission_bucket: Creation complete!", color: "#00ff9f" },
  { delay: 200,  type: "out",  text: "Apply complete! Resources: 1 added.", color: "#00ff9f" },
  { delay: 600,  type: "out",  text: "✓ Objective complete: Deploy your first resource", color: "#00ff9f" },
  { delay: 300,  type: "xp",   text: "+150 XP" },
];

interface Line {
  id: number;
  type: string;
  text: string;
  color?: string;
  typed?: string;
  done?: boolean;
}

let idCounter = 0;

export function DemoTerminal() {
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState<{ lineId: number; progress: number } | null>(null);
  const scriptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function runNext() {
      const step = scriptRef.current;
      if (step >= DEMO_SCRIPT.length) {
        // Loop after a pause
        timerRef.current = setTimeout(() => {
          scriptRef.current = 0;
          setLines([]);
          setTyping(null);
          runNext();
        }, 3000);
        return;
      }

      const item = DEMO_SCRIPT[step];
      scriptRef.current++;

      timerRef.current = setTimeout(() => {
        if (item.type === "cmd") {
          const id = ++idCounter;
          setLines((prev) => [...prev, { id, type: "cmd", text: item.text, typed: "", done: false }]);
          // Type out the command character by character
          let charIdx = 0;
          const typeChar = (): void => {
            charIdx++;
            setLines((prev) =>
              prev.map((l) =>
                l.id === id ? { ...l, typed: item.text.slice(0, charIdx), done: charIdx >= item.text.length } : l
              )
            );
            if (charIdx < item.text.length) {
              timerRef.current = setTimeout(typeChar, 50 + Math.random() * 30);
            } else {
              timerRef.current = setTimeout(runNext, 200);
            }
          };
          timerRef.current = setTimeout(typeChar, 100);
        } else if (item.type === "xp") {
          const id = ++idCounter;
          setLines((prev) => [...prev, { id, type: "xp", text: item.text }]);
          timerRef.current = setTimeout(runNext, 300);
        } else {
          const id = ++idCounter;
          setLines((prev) => [...prev, { id, type: "out", text: item.text, color: item.color, done: true }]);
          timerRef.current = setTimeout(runNext, 80);
        }
      }, item.delay);
    }

    runNext();
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      className="rounded-xl border border-noir-400 overflow-hidden font-mono text-xs"
      style={{ boxShadow: "0 0 40px rgba(0,255,159,0.08), 0 20px 60px rgba(0,0,0,0.5)" }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-noir-800 border-b border-noir-500">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger/60" />
          <div className="w-3 h-3 rounded-full bg-warning/60" />
          <div className="w-3 h-3 rounded-full bg-terminal/60" />
        </div>
        <span className="text-text-muted text-xs ml-2">agent@terraops:~/workspace</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-terminal animate-pulse" />
          <span className="text-terminal/60 text-xs">LIVE DEMO</span>
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={containerRef}
        className="bg-noir-950 p-4 h-52 overflow-y-auto space-y-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {lines.map((line) => {
          if (line.type === "cmd") {
            return (
              <div key={line.id} className="flex items-center gap-2">
                <span className="text-terminal/50">❯</span>
                <span className="text-purple">
                  {line.typed}
                  {!line.done && (
                    <span
                      className="inline-block w-1.5 h-3.5 bg-terminal ml-0.5 align-middle"
                      style={{ animation: "pulse 1s step-end infinite" }}
                    />
                  )}
                </span>
              </div>
            );
          }
          if (line.type === "xp") {
            return (
              <div
                key={line.id}
                className="text-gold font-bold mt-1"
                style={{ animation: "fadeIn 0.3s ease-out" }}
              >
                {line.text}
              </div>
            );
          }
          return (
            <div key={line.id} style={{ color: line.color ?? "#5a5a7a" }}>
              {line.text || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}
