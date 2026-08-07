import Link from "next/link";

// Nav for signed-out pages (login, signup, public artist profiles). Only two
// actions, so it needs no drawer — it fits a 320px screen as-is. Server
// component: no state, no client bundle.

export function PublicNav() {
  return (
    <nav className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="font-bold text-lg flex items-center gap-2 shrink-0">
          <span className="text-[var(--brand)]">●</span> Riff
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
