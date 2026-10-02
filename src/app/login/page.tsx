import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginClient from "./LoginClient";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

/**
 * Server component: redirect signed-in users to /dashboard (R2.4).
 * Signed-out users see the LoginClient (GitHub sign-in button).
 *
 * The callbackUrl search param is read here and passed as a prop so the
 * client component can use it without touching searchParams directly.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return <LoginClient callbackUrl={callbackUrl} />;
}
