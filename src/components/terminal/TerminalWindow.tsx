"use client";

import { useEffect, useRef, useCallback } from "react";

interface TerminalWindowProps {
  output: TerminalLine[];
  onCommand: (command: string) => void;
  isReady?: boolean;
}

export interface TerminalLine {
  text: string;
  type: "normal" | "success" | "error" | "warning" | "info" | "dim" | "bold" | "input";
  id: string;
}

const TYPE_COLORS: Record<TerminalLine["type"], string> = {
  normal: "#e2e2f0",
  success: "#00ff9f",
  error: "#ff3d71",
  warning: "#ffaa00",
  info: "#00c8ff",
  dim: "#5a5a7a",
  bold: "#ffffff",
  input: "#7c5df9",
};

export function TerminalWindow({ output, onCommand, isReady = true }: TerminalWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const value = inputRef.current?.value.trim() || "";
        if (!value) return;
        historyRef.current.unshift(value);
        historyIndexRef.current = -1;
        if (inputRef.current) inputRef.current.value = "";
        onCommand(value);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.min(historyIndexRef.current + 1, historyRef.current.length - 1);
        historyIndexRef.current = next;
        if (inputRef.current && historyRef.current[next] !== undefined) {
          inputRef.current.value = historyRef.current[next];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.max(historyIndexRef.current - 1, -1);
        historyIndexRef.current = next;
        if (inputRef.current) {
          inputRef.current.value = next === -1 ? "" : historyRef.current[next];
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const val = inputRef.current?.value || "";
        const COMPLETIONS = [
          "terraform init",
          "terraform validate",
          "terraform plan",
          "terraform apply -auto-approve",
          "terraform destroy -auto-approve",
          "terraform output",
          "terraform show",
          "terraform state list",
          "terraform state show",
          "terraform fmt",
          "terraform version",
          "ls",
          "pwd",
          "cat main.tf",
        ];
        const match = COMPLETIONS.find((c) => c.startsWith(val) && c !== val);
        if (match && inputRef.current) inputRef.current.value = match;
      }
    },
    [onCommand]
  );

  return (
    <div
      className="flex flex-col h-full bg-noir-950 rounded-lg border border-noir-500 overflow-hidden font-mono text-sm"
      style={{ boxShadow: "0 0 30px rgba(0,255,159,0.05)" }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-noir-800 border-b border-noir-500 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger/70" />
          <div className="w-3 h-3 rounded-full bg-warning/70" />
          <div className="w-3 h-3 rounded-full bg-terminal/70" />
        </div>
        <span className="text-xs text-text-muted ml-2">agent@terraops:~</span>
        <span className="ml-auto text-xs text-terminal/50">[SECURE SHELL]</span>
      </div>

      {/* Output */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-0.5 min-h-0">
        {output.map((line) => (
          <div key={line.id} className="leading-relaxed">
            {line.type === "input" ? (
              <span>
                <span className="text-terminal/60">❯ </span>
                <span style={{ color: TYPE_COLORS.input }}>{line.text}</span>
              </span>
            ) : line.text === "" ? (
              <div className="h-2" />
            ) : (
              <span
                style={{ color: TYPE_COLORS[line.type] }}
                className={line.type === "bold" ? "font-bold" : ""}
              >
                {line.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      {isReady && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-noir-500 bg-noir-900/50 shrink-0">
          <span className="text-terminal/60 shrink-0">❯</span>
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-text-primary outline-none placeholder-text-muted caret-terminal text-sm font-mono"
            placeholder="type a command... (Tab to autocomplete)"
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
    </div>
  );
}
