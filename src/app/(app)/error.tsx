"use client";

import { useEffect } from "react";

/**
 * Segment error boundary for every signed-in page. Without it a thrown server
 * error (most often: the database is unreachable) renders Next's bare
 * "A server error occurred" screen, which tells the artist nothing and hides
 * the digest needed to find the matching line in the service logs.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] segment render failed:", error);
  }, [error]);

  return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <div className="text-4xl">🎛️</div>
      <h1 className="text-2xl font-bold">This page didn&apos;t load</h1>
      <p className="text-[var(--muted)] text-sm">
        Something broke on our side — usually a hiccup talking to the database. Your progress is
        safe. Try again in a moment.
      </p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <button onClick={() => unstable_retry()} className="btn btn-primary px-6 py-3">
          Try again
        </button>
        <a href="/api/health" className="btn btn-ghost">
          Service status
        </a>
      </div>
      {error.digest && (
        <p className="text-xs text-[var(--muted)] pt-4">
          Reference code: <code>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
