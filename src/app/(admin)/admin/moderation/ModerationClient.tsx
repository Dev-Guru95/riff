"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReportActions({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "resolve" | "dismiss" | "delete_content") {
    setLoading(true);
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button className="btn btn-primary py-1.5 px-4 text-xs" disabled={loading} onClick={() => act("resolve")}>
        Resolve
      </button>
      <button
        className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition disabled:opacity-50"
        disabled={loading}
        onClick={() => act("dismiss")}
      >
        Dismiss
      </button>
      <button
        className="text-xs font-semibold text-[var(--brand-2)] hover:opacity-80 transition disabled:opacity-50"
        disabled={loading}
        onClick={() => act("delete_content")}
      >
        Remove content
      </button>
    </div>
  );
}
