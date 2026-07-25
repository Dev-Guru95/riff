import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/stripe";
import { ManageBillingButton } from "./BillingClient";

export default async function BillingSettings() {
  const session = (await getSession())!;
  const [ent, sub] = await Promise.all([
    getEntitlements(session.id),
    prisma.subscription.findUnique({ where: { userId: session.id } }),
  ]);
  const plan = PLANS[ent.plan];

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-bold">Billing</h1>

      <div className="card p-6">
        <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Current plan</div>
        <div className="text-2xl font-bold mt-1">{plan.name}</div>
        {sub?.currentPeriodEnd && (
          <div className="text-xs text-[var(--muted)] mt-1">
            {sub.status === "canceled" ? "Access until" : "Renews"} {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </div>
        )}
        <ul className="text-sm mt-4 space-y-1">
          <li>Coach messages/day: <strong>{ent.coachMessagesPerDay >= 1000 ? "Unlimited" : ent.coachMessagesPerDay}</strong></li>
          <li>Social connections: <strong>{ent.socialConnections}</strong></li>
          <li>All courses: <strong>{ent.allCourses ? "Yes" : "No"}</strong></li>
          <li>Human-reviewed assignments: <strong>{ent.humanReview ? "Yes" : "No"}</strong></li>
        </ul>
      </div>

      <div className="flex gap-2">
        {ent.plan === "free" ? (
          <Link href="/pricing" className="btn btn-primary">Upgrade</Link>
        ) : (
          <ManageBillingButton />
        )}
        <Link href="/pricing" className="btn btn-ghost">View plans</Link>
      </div>
    </main>
  );
}
