"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, slug, description, level }),
    });
    setLoading(false);
    if (res.ok) {
      setTitle(""); setSlug(""); setDescription(""); setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(fieldErrorMessage(d) ?? d.error ?? "Failed to create course");
    }
  }

  if (!open) {
    return <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New course</button>;
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <h2 className="font-semibold">New course</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <AdminInput label="Title" value={title} onChange={(v) => { setTitle(v); if (!slug) setSlug(slugify(v)); }} required minLength={3} />
        <AdminInput label="Slug" value={slug} onChange={(v) => setSlug(slugify(v))} required minLength={3} />
      </div>
      <AdminInput label="Description" value={description} onChange={setDescription} required minLength={3} placeholder="One sentence on what this course teaches" />
      <label className="block">
        <span className="text-xs text-[var(--muted)] mb-1 block">Level</span>
        <select className="admin-input" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
      {err && <p className="text-sm text-[var(--brand-2)]">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={loading}>{loading ? "Creating…" : "Create"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <AdminInputStyles />
    </form>
  );
}

export function PublishToggle({ id, isPublished }: { id: string; isPublished: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublished: !isPublished }),
    });
    setLoading(false);
    router.refresh();
  }
  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-3 py-1.5 rounded-full font-medium ${isPublished ? "bg-[var(--success)] text-black" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
    >
      {isPublished ? "Published" : "Draft"}
    </button>
  );
}

export function AdminInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)] mb-1 block">
        {label}{required && <span className="text-[var(--brand-2)]"> *</span>}
      </span>
      <input
        className="admin-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
      <AdminInputStyles />
    </label>
  );
}

// Turn a zod 422 response into a single readable "Field: message" line.
function fieldErrorMessage(d: unknown): string | null {
  const fe = (d as { issues?: { fieldErrors?: Record<string, string[]> } })?.issues?.fieldErrors;
  if (!fe) return null;
  const parts = Object.entries(fe).map(([field, msgs]) => {
    const nice = field.charAt(0).toUpperCase() + field.slice(1);
    const msg = (msgs?.[0] ?? "is invalid").replace(/Too small: expected string to have >=(\d+) characters/, "must be at least $1 characters");
    return `${nice} ${msg}`;
  });
  return parts.length ? parts.join("; ") : null;
}

export function AdminInputStyles() {
  return (
    <style>{`.admin-input{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.5rem;padding:.5rem .7rem;font-size:.85rem;color:var(--foreground);outline:none}.admin-input:focus{border-color:var(--brand)}`}</style>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
