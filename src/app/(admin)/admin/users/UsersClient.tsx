"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserActions({
  id,
  status,
  role,
  plan,
  skoolMember,
  requested,
}: {
  id: string;
  status: string;
  role: string;
  plan: string;
  skoolMember: boolean;
  requested: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1 justify-end items-center">
      {/* Tier, granted by hand. Writes straight to the subscription — no Stripe
          charge — so an artist can be comped or moved between free and paid. */}
      <select
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-xs px-1 py-1 outline-none"
        value={plan}
        disabled={loading}
        onChange={(e) => patch({ plan: e.target.value })}
        title="Change tier (no payment taken)"
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
        <option value="premium">premium</option>
      </select>
      <select
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-xs px-1 py-1 outline-none"
        value={role}
        disabled={loading}
        onChange={(e) => patch({ role: e.target.value })}
        title="Change role"
      >
        <option value="artist">artist</option>
        <option value="reviewer">reviewer</option>
        <option value="moderator">moderator</option>
        <option value="admin">admin</option>
      </select>
      <button
        className={`text-xs px-2 py-1 rounded-md ${
          skoolMember
            ? "bg-[var(--brand)]/20 text-[var(--brand)]"
            : requested
              ? "bg-[var(--brand)] text-white hover:opacity-90"
              : "bg-[var(--surface-2)] hover:bg-[var(--border)]"
        }`}
        disabled={loading}
        title={
          skoolMember
            ? "Revoke Skool community membership"
            : requested
              ? "Verify — this user requested access"
              : "Grant Skool community membership"
        }
        onClick={() => patch({ skoolMember: !skoolMember })}
      >
        {skoolMember ? "Member ✓" : requested ? "Verify ⏳" : "Verify"}
      </button>
      <button
        className="text-xs px-2 py-1 rounded-md bg-[var(--surface-2)] hover:bg-[var(--border)]"
        disabled={loading}
        onClick={() => patch({ status: status === "active" ? "suspended" : "active" })}
      >
        {status === "active" ? "Suspend" : "Activate"}
      </button>
    </div>
  );
}
