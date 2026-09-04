import { AuthForm } from "../AuthForm";
import { safeNextPath } from "@/lib/nextPath";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Skool links point straight at a quiz or action step. Someone not signed in
  // is sent here with that destination attached, so they land on the page they
  // clicked rather than a generic dashboard.
  const { next } = await searchParams;
  return <AuthForm mode="login" next={safeNextPath(next)} />;
}
