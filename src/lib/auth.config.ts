/**
 * Adapter-free NextAuth configuration with GitHub OAuth + Credentials.
 */
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { compare } from "bcryptjs";
import { prisma } from "./db";

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
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.AUTH_GITHUB_SECRET || "",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { credential: true },
        });

        if (!user || !user.credential) {
          return null;
        }

        const isValid = await compare(
          credentials.password as string,
          user.credential.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
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
