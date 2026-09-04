import { AuthForm } from "../AuthForm";
import { safeNextPath } from "@/lib/nextPath";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" next={safeNextPath(next)} />;
}
