import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";

export const metadata = {
  title: "Delete your Riff account",
  description: "How to permanently delete your Riff account and the data associated with it.",
};

/**
 * The URL submitted in the Play Console "Data deletion" field.
 *
 * Play requires this page to be reachable by a reviewer who has not installed
 * the app and is not signed in, so it lives outside the (app) route group and
 * behind no auth check. It must state what is deleted, what is kept, and for
 * how long — reviewers read it.
 */
export default function AccountDeletionPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Delete your Riff account</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Riff — <span className="font-mono">com.riff.app</span>
          </p>
        </header>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Delete it yourself, in seconds</h2>
          <ol className="text-sm space-y-1.5 list-decimal pl-5 text-[var(--muted)]">
            <li>Open the Riff app, or sign in on the website.</li>
            <li>Go to <strong className="text-[var(--foreground)]">Settings</strong> from the main menu.</li>
            <li>Choose <strong className="text-[var(--foreground)]">Delete my account</strong>.</li>
            <li>Confirm with your password and type <strong className="text-[var(--foreground)]">DELETE</strong>.</li>
          </ol>
          <p className="text-sm text-[var(--muted)] mt-3">
            Deletion happens immediately. There is no waiting period and no recovery window.
          </p>
          <Link href="/settings" className="btn btn-primary mt-4">Go to Settings</Link>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Cannot sign in?</h2>
          <p className="text-sm text-[var(--muted)]">
            Email{" "}
            <a className="text-[var(--accent)] underline" href="mailto:support@soundring.io">
              support@soundring.io
            </a>{" "}
            from the address on the account and ask for it to be deleted. We will confirm it
            is you before acting, and complete the request within 30 days.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">What gets deleted</h2>
          <p className="text-sm text-[var(--muted)] mb-2">
            Everything tied to your account is erased permanently:
          </p>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5">
            <li>Your login, email address and password</li>
            <li>Your artist profile, stage name and genres</li>
            <li>Course enrolments, lesson progress, quiz attempts and submitted assignments</li>
            <li>XP, levels, streaks, badges, missions and certificates</li>
            <li>AI Coach conversations and the memory built from them</li>
            <li>Audits, roadmaps and connected social accounts</li>
            <li>Project boards, cards, checklists, comments and attachments you own</li>
            <li>Studio data — brand kit, merch, gigs, finance entries, fans, broadcasts, bookings, goals and link page</li>
            <li>Community threads and posts you wrote</li>
            <li>Notifications, analytics events, coupon redemptions and leaderboard history</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">What is kept, and why</h2>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5">
            <li>
              <strong className="text-[var(--foreground)]">Payment records.</strong> If you ever paid,
              our payment processor (Stripe) keeps the transaction record for as long as tax and
              accounting law requires. We cannot delete those, and neither can you — this applies
              to every business. They are held by Stripe, not by Riff.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Backups.</strong> Your data may persist in
              encrypted database backups for up to 30 days before those backups age out. It is not
              reachable by the app or by staff during that window.
            </li>
          </ul>
          <p className="text-sm text-[var(--muted)] mt-2">
            Any active subscription is cancelled as part of deletion, so you are not billed again.
          </p>
        </section>

        <p className="text-sm text-[var(--muted)]">
          See also our <Link href="/privacy" className="text-[var(--accent)] underline">Privacy Policy</Link>.
        </p>
      </main>
    </>
  );
}
