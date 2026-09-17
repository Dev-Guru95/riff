import Link from "next/link";

// The Riff wordmark. The redesign sets it in a blackletter face tinted with the
// brand purple, replacing the former "● Riff" text mark. The font is loaded in
// the root layout as --font-display (see src/app/layout.tsx).

export function Wordmark({
  href,
  suffix,
  className = "",
}: {
  href?: string;
  suffix?: string;
  className?: string;
}) {
  const mark = (
    <span className={`flex items-baseline gap-1.5 ${className}`}>
      <span
        className="text-[var(--brand)] text-2xl leading-none tracking-wide"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Riff
      </span>
      {suffix && <span className="text-xs text-[var(--muted)] font-normal">{suffix}</span>}
    </span>
  );

  return href ? (
    <Link href={href} className="shrink-0">
      {mark}
    </Link>
  ) : (
    mark
  );
}
