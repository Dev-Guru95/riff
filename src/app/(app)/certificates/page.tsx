import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProgramProgress } from "@/lib/certificates";
import { PROGRAM_KEY, PROGRAM_TITLE } from "@/lib/constants";
import { buildShare } from "@/lib/share";
import { ShareToSkool } from "@/components/ShareToSkool";
import { CertificateArtwork } from "@/components/CertificateArtwork";

export default async function CertificatesPage() {
  const session = (await getSession())!;
  const [cert, profile, progress] = await Promise.all([
    prisma.certificate.findUnique({
      where: { userId_programKey: { userId: session.id, programKey: PROGRAM_KEY } },
    }),
    prisma.artistProfile.findUnique({ where: { userId: session.id }, select: { stageName: true } }),
    getProgramProgress(session.id),
  ]);
  const recipient = profile?.stageName ?? "you";

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">🎓 Program Certificate</h1>
        <p className="text-sm text-[var(--muted)]">
          Complete every track in the {PROGRAM_TITLE} to earn your certificate — then share it with the community.
        </p>
      </header>

      {cert ? (
        <div className="card overflow-hidden">
          <CertificateArtwork title={cert.title} recipient={recipient} issuedAt={cert.issuedAt} serial={cert.serial} />
          <div className="p-4 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--muted)] font-mono">#{cert.serial.slice(0, 10)}</span>
            <ShareToSkool share={buildShare({ kind: "certificate", value: cert.title, stageName: profile?.stageName })} size="sm" />
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h2 className="font-semibold mb-1">Your certificate is waiting</h2>
          <p className="text-sm text-[var(--muted)] mb-5">
            {progress.total === 0
              ? "No courses are published yet — check back soon."
              : `You've completed ${progress.completed} of ${progress.total} tracks. Finish them all to unlock your certificate.`}
          </p>
          {progress.total > 0 && (
            <ul className="text-left max-w-sm mx-auto space-y-2 mb-6">
              {progress.tracks.map((t) => (
                <li key={t.slug} className="flex items-center gap-2 text-sm">
                  <span>{t.done ? "✅" : "⬜"}</span>
                  <Link href={`/courses/${t.slug}`} className={t.done ? "text-[var(--success)]" : "hover:text-[var(--brand)]"}>
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/courses" className="btn btn-primary">Continue learning</Link>
        </div>
      )}
    </main>
  );
}
