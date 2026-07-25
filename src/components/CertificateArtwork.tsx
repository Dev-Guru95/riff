// Placeholder certificate artwork. This is the single seam a designer replaces
// with the production design — either reskin this component, or point it at the
// finished art in `public/certificate/` (see CERTIFICATE_TEMPLATE in
// src/lib/assets.ts). Keep the same props so callers don't change.

export function CertificateArtwork({
  title,
  recipient,
  issuedAt,
  serial,
}: {
  title: string;
  recipient: string;
  issuedAt: Date | string;
  serial: string;
}) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div
      className="relative p-10 text-center text-white"
      style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
    >
      <div className="absolute inset-4 border border-white/40 pointer-events-none" />
      <div className="absolute inset-6 border border-white/20 pointer-events-none" />
      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.25em] opacity-80">Certificate of Completion</div>
        <div className="text-5xl my-4">🎓</div>
        <div className="text-sm opacity-85">This certifies that</div>
        <div className="text-3xl font-bold mt-1">{recipient}</div>
        <div className="mx-auto my-3 h-px w-48 bg-white/40" />
        <div className="text-sm opacity-85">has completed the</div>
        <div className="text-xl font-semibold mt-1">{title}</div>
        <div className="text-xs opacity-70 mt-6">
          {date} · #{serial.slice(0, 10)} · Soundring · Riff
        </div>
      </div>
    </div>
  );
}
