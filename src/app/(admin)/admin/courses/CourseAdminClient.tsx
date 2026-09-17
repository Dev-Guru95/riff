"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icons";

export function CreateCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The redesign fronts this form with a split button whose menu also offers
  // the importer (/admin/import), which no longer has its own sidebar entry.
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Dismiss the menu / form panel on Escape or an outside click, the way a
  // native menu behaves. Only wired up while something is actually open.
  useEffect(() => {
    if (!menuOpen && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen, open]);

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

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-primary"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((v) => !v);
          setOpen(false);
        }}
      >
        New course <Icon name="chevronDown" size={14} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-30 card p-1 w-44 shadow-lg shadow-black/40"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-[var(--surface-2)] transition"
          >
            <Icon name="pencil" size={15} /> Start fresh
          </button>
          <Link
            role="menuitem"
            href="/admin/import"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)] transition"
          >
            <Icon name="download" size={15} /> Import
          </Link>
        </div>
      )}

      {open && (
    <form
      onSubmit={submit}
      className="absolute right-0 top-full mt-2 z-30 card p-5 space-y-3 shadow-lg shadow-black/40 text-left w-[min(24rem,calc(100vw-2rem))]"
    >
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
      )}
    </div>
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
