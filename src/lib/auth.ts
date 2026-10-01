import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

// `||` (not `??`) so an empty-string env var still falls back to the alias.
const env = process.env;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // AUTH_SECRET is the v5 name; NEXTAUTH_SECRET kept for compatibility.
  secret: env.AUTH_SECRET || env.NEXTAUTH_SECRET,
  // Amplify serves the app behind CloudFront, so the Host header is proxied.
  // Callback URLs come from AUTH_URL/NEXTAUTH_URL when set (read by next-auth).
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
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
});
