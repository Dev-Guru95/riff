import { prisma } from "@/lib/prisma";
import { CreateCouponForm, IssueRewardsButton } from "./CouponsClient";

export default async function AdminCoupons() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Coupons & Rewards</h1>
      <p className="text-sm text-[var(--muted)]">Create discount codes. The <code>TOP1000</code> reward auto-applies to top leaderboard ranks.</p>

      <IssueRewardsButton />
      <CreateCouponForm />

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[8rem_5rem_1fr_6rem] gap-2 px-4 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
          <span>Code</span><span>Value</span><span>Description</span><span className="text-right">Redeemed</span>
        </div>
        {coupons.map((c) => (
          <div key={c.id} className="grid grid-cols-[8rem_5rem_1fr_6rem] gap-2 px-4 py-3 text-sm border-b border-[var(--border)] last:border-0 items-center">
            <span className="font-mono font-semibold">{c.code}</span>
            <span>{c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `$${c.value}` : "reward"}</span>
            <span className="text-[var(--muted)] truncate">{c.description}</span>
            <span className="text-right text-xs">{c.redeemed}/{c.maxRedemptions || "∞"}</span>
          </div>
        ))}
        {coupons.length === 0 && <div className="px-4 py-6 text-center text-[var(--muted)] text-sm">No coupons yet.</div>}
      </div>
    </div>
  );
}
