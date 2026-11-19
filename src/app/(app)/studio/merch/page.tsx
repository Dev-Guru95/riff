import { requirePageSession } from "@/lib/auth";
import { listMerchAndGigs } from "@/lib/studio-tools";
import { merchPlanQuota } from "@/lib/entitlements";
import { BILLING_CURRENCY } from "@/lib/stripe";
import { MerchGigClient } from "./MerchGigClient";

export const metadata = { title: "Merch Planner — Riff" };

export default async function MerchPage() {
  const session = await requirePageSession();
  // The AI allowance is resolved server-side so the generator renders in its
  // real state on first paint — available with a count, or an upgrade card —
  // rather than offering a button the API would refuse.
  const [data, quota] = await Promise.all([
    listMerchAndGigs(session.id),
    merchPlanQuota(session.id),
  ]);

  return (
    <MerchGigClient
      initial={data}
      currency={BILLING_CURRENCY}
      ai={{
        plan: quota.plan,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        campaigns: quota.campaigns,
      }}
    />
  );
}
