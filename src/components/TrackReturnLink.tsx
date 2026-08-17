import type { TrackReturnLink } from "@/lib/returnLink";

// Presentational only (no "use client") so it works from the course page (a
// Server Component) and from inside LessonPlayer (a Client Component) alike.
// Plain <a>, not next/link: the destination is an external origin (Skool).

export function TrackReturnButton({
  link,
  variant = "primary",
  className = "",
}: {
  link: TrackReturnLink;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`}
    >
      {link.label} ↗
    </a>
  );
}
