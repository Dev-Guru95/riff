import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getProgramProgress } from "@/lib/certificates";
import { PROGRAM_KEY, PROGRAM_TITLE } from "@/lib/constants";
import { buildShare } from "@/lib/share";
import type { CertificatesResponse } from "@/lib/mobile/types";

// GET /api/mobile/certificates — src/app/(app)/certificates/page.tsx.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [cert, profile, program] = await Promise.all([
    prisma.certificate.findUnique({
      where: { userId_programKey: { userId: session.id, programKey: PROGRAM_KEY } },
    }),
    prisma.artistProfile.findUnique({ where: { userId: session.id }, select: { stageName: true } }),
    getProgramProgress(session.id),
  ]);
  const stageName = profile?.stageName ?? null;

  const body: CertificatesResponse = {
    programTitle: PROGRAM_TITLE,
    certificate: cert
      ? { serial: cert.serial, title: cert.title, programKey: cert.programKey, issuedAt: cert.issuedAt.toISOString() }
      : null,
    recipient: stageName ?? "you",
    stageName,
    program,
    share: cert ? buildShare({ kind: "certificate", value: cert.title, stageName }) : null,
  };
  return ok(body);
});
