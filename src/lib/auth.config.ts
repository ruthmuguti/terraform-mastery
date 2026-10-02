/**
 * Adapter-free NextAuth configuration with Credentials only.
 */
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
