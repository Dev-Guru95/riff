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
    <div className="flex gap-2">
      <button className="btn btn-primary py-1.5 px-3 text-xs" disabled={loading} onClick={() => act("delete_content")}>Remove content</button>
      <button className="btn btn-ghost py-1.5 px-3 text-xs" disabled={loading} onClick={() => act("resolve")}>Resolve</button>
      <button className="btn btn-ghost py-1.5 px-3 text-xs" disabled={loading} onClick={() => act("dismiss")}>Dismiss</button>
    </div>
  );
}
