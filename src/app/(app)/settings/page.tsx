import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { DeleteAccountForm } from "./DeleteAccountClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      email: true,
      createdAt: true,
      mfaEnabled: true,
      profile: { select: { stageName: true } },
      subscription: { select: { plan: true, status: true } },
    },
  });

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <PageHeader title="Settings" subtitle="Your account and data" />

      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Account</h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Email</dt>
            <dd className="truncate">{user?.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Artist name</dt>
            <dd className="truncate">{user?.profile?.stageName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Member since</dt>
            <dd>{user?.createdAt.toLocaleDateString()}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Two-factor</dt>
            <dd>{user?.mfaEnabled ? "On" : "Off"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Plan</dt>
            <dd className="capitalize">{user?.subscription?.plan ?? "free"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/settings/billing" className="btn btn-ghost">Billing</Link>
          <Link href="/privacy" className="btn btn-ghost">Privacy policy</Link>
        </div>
      </section>

      {/* Play's User Data policy requires deletion to be reachable from inside
          the app, not only from a web page. This is that entry point. */}
      <section className="card p-5 border-[var(--brand-2)]">
        <h2 className="text-sm font-semibold mb-1">Delete account</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Permanently deletes your account and everything in it — progress, XP, badges,
          certificates, boards, Studio data, coach history and community posts. This cannot
          be undone and support cannot restore it.
          {user?.subscription?.status === "active" && " Your subscription will be cancelled."}
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
