import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";

// Login and signup previously rendered a bare centred card with no navigation,
// leaving no way back to the site.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      <div className="flex-1">{children}</div>
      {/* The policy links sit on the sign-in pages because that is where someone
          decides whether to hand over an email address — and because a store
          reviewer must be able to reach them without an account. */}
      <footer className="border-t border-[var(--border)] py-5">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
          <Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy Policy</Link>
          <Link href="/account/deletion" className="hover:text-[var(--foreground)]">Delete your account</Link>
        </div>
      </footer>
    </>
  );
}
