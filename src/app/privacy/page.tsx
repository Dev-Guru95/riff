import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";

export const metadata = {
  title: "Privacy Policy — Riff",
  description: "What Riff collects, why, who it is shared with, and how to delete it.",
};

// Last substantive change to this policy. Update it whenever the content below
// changes — reviewers and users both look for a real date.
const LAST_UPDATED = "23 September 2026";

/**
 * Public, unauthenticated. The URL goes in the Play Console listing and must
 * match the Data Safety declaration exactly: reviewers compare the two, and a
 * mismatch is a rejection on its own.
 *
 * Every disclosure below was written from what the code actually does — the
 * Prisma schema, the Stripe integration, the DeepSeek client and the upload
 * handler — rather than from a generic template.
 */
export default function PrivacyPolicyPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Last updated {LAST_UPDATED}</p>
        </header>

        <p className="text-sm text-[var(--muted)]">
          This policy covers the Riff website and the Riff Android app
          (<span className="font-mono">com.riff.app</span>). Both are the same product and share
          one account and one database, so everything here applies equally to whichever you use.
        </p>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Who we are</h2>
          <p className="text-sm text-[var(--muted)]">
            Riff is operated by [LEGAL ENTITY NAME], [REGISTERED ADDRESS]. For anything about
            your data, contact{" "}
            <a className="text-[var(--accent)] underline" href="mailto:support@soundring.io">
              support@soundring.io
            </a>.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">What we collect</h2>

          <h3 className="text-sm font-semibold mt-3">You give us</h3>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5 mt-1">
            <li><strong className="text-[var(--foreground)]">Account:</strong> email address and a password. Passwords are stored only as a bcrypt hash — we never hold the password itself and cannot read it.</li>
            <li><strong className="text-[var(--foreground)]">Profile:</strong> artist/stage name, genres and country, if you provide them.</li>
            <li><strong className="text-[var(--foreground)]">Your work:</strong> assignment submissions, uploaded files and images, project boards and cards, comments, Studio records (merch, gigs, finances, fans, bookings, goals), and community threads and posts.</li>
            <li><strong className="text-[var(--foreground)]">AI Coach messages:</strong> what you write to the coach, and a memory summarised from it.</li>
            <li><strong className="text-[var(--foreground)]">Two-factor secret:</strong> if you enable 2FA.</li>
          </ul>

          <h3 className="text-sm font-semibold mt-3">Created as you use Riff</h3>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5 mt-1">
            <li>Course enrolments, lesson progress, quiz attempts, XP, levels, streaks, badges, missions and certificates.</li>
            <li>Product analytics events — which actions you took and when — used to run features such as streaks, quotas and the leaderboard.</li>
            <li>The referral tag on the link that brought you to Riff, and the date you last used it.</li>
          </ul>

          <h3 className="text-sm font-semibold mt-3">If you connect them</h3>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5 mt-1">
            <li>Social platform accounts (Spotify, YouTube, Facebook, Instagram, TikTok, X) for the audit feature. Access tokens are encrypted before storage.</li>
          </ul>

          <p className="text-sm text-[var(--muted)] mt-3">
            The Android app collects nothing on its own. It has no advertising identifier, no
            analytics SDK and no location, contacts or microphone access. It asks only for
            notification permission, and for access to a file or the camera at the moment you
            choose to upload something.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Why we use it</h2>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5">
            <li>To give you an account and keep you signed in.</li>
            <li>To deliver the courses, track your progress and issue certificates.</li>
            <li>To run features you ask for — the AI coach, audits, boards, Studio tools and the leaderboard.</li>
            <li>To take payment for a paid plan and give you the right level of access.</li>
            <li>To keep the community safe, by acting on reports and blocks.</li>
            <li>To keep the service secure — rate limiting and abuse prevention.</li>
          </ul>
          <p className="text-sm text-[var(--muted)] mt-2">
            We do not sell your personal data, and we do not use it for advertising or share it
            with data brokers.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Who we share it with</h2>
          <p className="text-sm text-[var(--muted)] mb-2">
            Only the providers needed to run the service:
          </p>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5">
            <li><strong className="text-[var(--foreground)]">Render</strong> — hosting and the database.</li>
            <li><strong className="text-[var(--foreground)]">Stripe</strong> — payments. Stripe handles your card details directly; card numbers never reach Riff.</li>
            <li><strong className="text-[var(--foreground)]">DeepSeek</strong> — the AI model behind the coach and assignment feedback. Messages you send to the coach, and assignment text you submit for review, are sent to this provider to generate a reply.</li>
            <li><strong className="text-[var(--foreground)]">Social platforms</strong> — only those you explicitly connect, and only to read the audit data you asked for.</li>
          </ul>
          <p className="text-sm text-[var(--muted)] mt-2">
            We may also disclose data where the law requires it.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Keeping it safe</h2>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5">
            <li>All traffic is encrypted with HTTPS. The Android app refuses unencrypted connections outright.</li>
            <li>Passwords are hashed with bcrypt and are never recoverable in plain text.</li>
            <li>Social access tokens are encrypted before they are stored.</li>
            <li>Your session is held in a cookie that page scripts cannot read, and the app stores no copy of your password.</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">How long we keep it</h2>
          <p className="text-sm text-[var(--muted)]">
            For as long as your account exists. When you delete your account it is erased
            immediately, other than encrypted database backups that age out within 30 days, and
            payment records Stripe must retain to satisfy tax and accounting law.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Your choices</h2>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-5">
            <li><strong className="text-[var(--foreground)]">Delete your account</strong> at any time from Settings — see <Link href="/account/deletion" className="text-[var(--accent)] underline">how to delete your account</Link>.</li>
            <li><strong className="text-[var(--foreground)]">Disconnect a social account</strong> at any time from the audit screen.</li>
            <li><strong className="text-[var(--foreground)]">Turn off notifications</strong> in your device settings.</li>
            <li>Depending on where you live you may also have the right to access, correct, export or restrict use of your data. Email us and we will action it.</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Children</h2>
          <p className="text-sm text-[var(--muted)]">
            Riff is not intended for children under 13, and we do not knowingly collect their
            data. If you believe a child has created an account, contact us and we will delete it.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-2">Changes</h2>
          <p className="text-sm text-[var(--muted)]">
            If this policy changes materially we will update the date above and let you know in
            the app before the change takes effect.
          </p>
        </section>
      </main>
    </>
  );
}
