/**
 * Adapter-free NextAuth configuration.
 *
 * Importable from any Node context (server components, API handlers, edge)
 * without pulling in Prisma or the DB adapter. The adapter lives only in
 * `auth.ts`, which spreads this config and adds PrismaAdapter.
 */
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

// `||` (not `??`) so an empty-string env var still falls back to the alias.
const env = process.env;

/**
 * Accepts a same-origin relative URL (starts with `/`, but not `//` or `/\`,
 * and no control characters); otherwise falls back to `/dashboard`.
 *
 * Used by the NextAuth `redirect` callback and by `/login` for the
 * post-sign-in redirect.
 */
export function safeCallback(raw: unknown): string {
  if (typeof raw !== "string") return "/dashboard";
  if (
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\") &&
    !/[\x00-\x1f]/.test(raw)
  ) {
    return raw;
  }
  return "/dashboard";
}

export const authConfig = {
  secret: env.AUTH_SECRET || env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    GitHub({
      clientId: env.GITHUB_CLIENT_ID || env.AUTH_GITHUB_ID || "",
      clientSecret: env.GITHUB_CLIENT_SECRET || env.AUTH_GITHUB_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id;
      }
      if (profile) {
        // profile is typed as Profile which has [claim: string]: unknown;
        // GitHub's profile always includes a `login` field (the username).
        token.login = (profile as { login?: string }).login ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          (session.user as { id?: string }).id = token.id as string;
        }
      }
      return session;
    },
    async redirect({ url }) {
      return safeCallback(url);
    },
  },
} satisfies NextAuthConfig;
