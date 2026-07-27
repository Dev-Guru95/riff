"use client";

import { useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

// Toolbar button — declared at module scope (not during render) so its identity
// is stable and React doesn't reset it each render.
function ToolButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="px-2 py-1 rounded text-xs hover:bg-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {label}
    </button>
  );
}

// Lightweight markdown editor: a formatting toolbar + Write/Preview tabs.
// Preview uses the XSS-safe renderMarkdown (escapes before transforming).
export function MarkdownEditor({
  value,
  onChange,
  disabled,
  rows = 6,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  function wrap(before: string, after: string, ph = "") {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = value.slice(s, e) || ph;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
    });
  }

  function linePrefix(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    requestAnimationFrame(() => ta.focus());
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface-2)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-1">
        <div className="flex items-center gap-0.5 py-1">
          {!disabled && tab === "write" && (
            <>
              <ToolButton label="B" title="Bold" onClick={() => wrap("**", "**", "bold")} />
              <ToolButton label="I" title="Italic" onClick={() => wrap("_", "_", "italic")} />
              <ToolButton label="•" title="Bulleted list" onClick={() => linePrefix("- ")} />
              <ToolButton label="1." title="Numbered list" onClick={() => linePrefix("1. ")} />
              <ToolButton label="‹›" title="Code" onClick={() => wrap("`", "`", "code")} />
              <ToolButton label="🔗" title="Link" onClick={() => wrap("[", "](https://)", "text")} />
            </>
          )}
        </div>
        <div className="flex text-xs">
          <button type="button" onClick={() => setTab("write")} className={`px-2 py-1.5 ${tab === "write" ? "text-[var(--brand)] font-medium" : "text-[var(--muted)]"}`}>Write</button>
          <button type="button" onClick={() => setTab("preview")} className={`px-2 py-1.5 ${tab === "preview" ? "text-[var(--brand)] font-medium" : "text-[var(--muted)]"}`}>Preview</button>
        </div>
      </div>
      {tab === "write" ? (
        <textarea
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full text-sm bg-transparent px-3 py-2 outline-none resize-y disabled:opacity-60"
        />
      ) : (
        <div
          className="markdown-body text-sm px-3 py-2 min-h-[6rem]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || '<p class="opacity-50">Nothing to preview</p>' }}
        />
      )}
    </div>
  );
}
