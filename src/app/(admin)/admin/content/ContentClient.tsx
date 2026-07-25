"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContentDecision({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setLoading(true);
    await fetch(`/api/admin/content-suggestions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button className="btn btn-primary py-1.5 px-4 text-xs" disabled={loading} onClick={() => decide("approved")}>Approve</button>
      <button className="btn btn-ghost py-1.5 px-4 text-xs" disabled={loading} onClick={() => decide("rejected")}>Reject</button>
    </div>
  );
}
