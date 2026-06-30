import Link from "next/link";
import { Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-noir-950 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-terminal/10 border border-terminal/30 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-terminal" />
          </div>
          <span className="font-mono font-bold text-terminal tracking-widest">TERRAOPS</span>
        </div>

        <div className="font-mono text-6xl font-bold text-noir-400 mb-4">404</div>
        <h1 className="font-mono text-text-primary font-bold text-lg mb-3">Route Not Found</h1>
        <p className="text-text-muted text-sm font-mono mb-2">
          <span className="text-danger">Error:</span> No configuration exists at this path.
        </p>
        <p className="text-text-muted text-sm font-mono mb-8">
          The requested operation does not exist in the mission registry.
        </p>

        <div className="bg-noir-800 border border-noir-500 rounded-lg p-4 mb-8 text-left">
          <div className="text-xs font-mono text-text-muted mb-2">❯ terraform plan</div>
          <div className="text-xs font-mono text-danger">
            Error: No such resource: path &quot;{'{'}current_route{'}'}&quot;
          </div>
          <div className="text-xs font-mono text-text-muted mt-1">
            Suggestion: Run <span className="text-terminal">terraform init</span> at home base
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-terminal/10 border border-terminal/25 text-terminal font-mono text-sm hover:bg-terminal/20 transition-all"
        >
          Return to Base
        </Link>
      </div>
    </main>
  );
}
