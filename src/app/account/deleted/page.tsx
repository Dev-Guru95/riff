import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";

export const metadata = { title: "Account deleted — Riff" };

// Public on purpose: by the time anyone lands here their session is gone, so
// anything behind auth would just bounce them to the login screen.
export default async function AccountDeletedPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;

  return (
    <>
      <PublicNav />
      <main className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your account has been deleted</h1>
        <p className="text-sm text-[var(--muted)] mt-3">
          Your account and the data belonging to it have been permanently removed from Riff.
          Nothing is kept in a recycle bin and support cannot restore it.
        </p>

        {billing === "1" && (
          <p className="text-sm mt-4 card p-4 text-left">
            <strong>One thing to check.</strong> We could not reach our payment provider to
            cancel your subscription automatically. Please check your card statement, or
            contact us so we can cancel it for you — you will not be able to sign in to do
            it yourself.
          </p>
        )}

        <p className="text-sm text-[var(--muted)] mt-6">
          You are welcome back any time — signing up again starts a fresh account.
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <Link href="/signup" className="btn btn-primary">Create a new account</Link>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </main>
    </>
  );
}
