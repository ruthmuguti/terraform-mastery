"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Signup failed");
          setLoading(false);
          return;
        }

        // Auto sign in after signup
        const signInResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError("Signup succeeded but sign-in failed. Please try signing in.");
          setMode("signin");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Invalid email or password");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-terminal/10 border border-terminal/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-terminal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19h8M4 17l6-6-6-6" />
              </svg>
            </div>
            <span className="text-2xl font-bold font-mono text-terminal tracking-widest">TERRAOPS</span>
          </div>
          <h1 className="text-2xl font-bold font-mono text-text-primary mb-2">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </h1>
          <p className="text-text-muted text-sm font-mono">
            {mode === "signin" ? "Welcome back, agent" : "Join the mission"}
          </p>
        </div>

        <div className="bg-noir-800 border border-noir-500 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono text-text-muted mb-2">NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-noir-700 border border-noir-400 rounded-lg px-4 py-3 text-text-primary font-mono text-sm outline-none focus:border-terminal/50 transition-colors"
                  placeholder="Agent name"
                  required
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-mono text-text-muted mb-2">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-noir-700 border border-noir-400 rounded-lg px-4 py-3 text-text-primary font-mono text-sm outline-none focus:border-terminal/50 transition-colors"
                placeholder="agent@terraops.dev"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-text-muted mb-2">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-noir-700 border border-noir-400 rounded-lg px-4 py-3 text-text-primary font-mono text-sm outline-none focus:border-terminal/50 transition-colors"
                placeholder="••••••••"
                required
                minLength={8}
              />
              {mode === "signup" && (
                <p className="text-xs text-text-muted font-mono mt-1">Min 8 characters</p>
              )}
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-xs font-mono text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg bg-terminal text-noir-950 font-mono font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError("");
                }}
                className="text-xs font-mono text-terminal hover:text-terminal/80 transition-colors"
              >
                {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
