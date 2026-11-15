import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * Landing page for the link in the reset email.
 *
 * The token is read here and handed to the form rather than pulled from the
 * URL client-side, so there is no Suspense boundary to get wrong and the page
 * renders the "bad link" state without a round trip. The token is only checked
 * when the form is submitted — validating it on load would let someone burn a
 * link just by opening it.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="card p-8 w-full max-w-sm">
        <Link href="/" className="font-bold text-lg flex items-center gap-2 mb-6">
          <span className="text-[var(--brand)]">●</span> Riff
        </Link>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1">This link is incomplete</h1>
            <p className="text-sm text-[var(--muted)] mb-6">
              The reset link is missing its token. Some email clients split long links across lines — try copying the
              whole address, or request a fresh one.
            </p>
            <Link href="/forgot-password" className="btn btn-primary w-full py-3">Request a new link</Link>
          </>
        )}
      </div>
    </main>
  );
}
