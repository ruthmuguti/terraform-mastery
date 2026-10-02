"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { SyncManager } from "@/lib/sync/SyncManager";

/**
 * Client boundary that seeds the NextAuth session (avoids signed-out flash
 * in the TopBar) and hosts the SyncManager for queue lifecycle and status.
 */
export function AppProviders({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <SyncManager />
      {children}
    </SessionProvider>
  );
}
