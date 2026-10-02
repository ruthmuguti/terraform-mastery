import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginClient } from "./LoginClient";

/**
 * Server component: redirect signed-in users to /dashboard.
 * Signed-out users see the LoginClient (email/password + GitHub sign-in).
 */
export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return <LoginClient />;
}
