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
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGitHub = async () => {
    setLoading(true);
    await signIn("github", { callbackUrl: "/dashboard" });
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

        <div className="bg-noir-800 border border-noir-500 rounded-xl p-6 space-y-4">
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
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-noir-500"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-noir-800 px-2 text-text-muted font-mono">OR</span>
            </div>
          </div>

          <button
            onClick={handleGitHub}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-noir-700 border border-noir-400 text-text-primary font-mono font-bold text-sm hover:border-noir-300 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Continue with GitHub
          </button>

          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
              className="text-xs font-mono text-terminal hover:text-terminal/80 transition-colors"
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
