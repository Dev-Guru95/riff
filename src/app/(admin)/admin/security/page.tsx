import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { MfaManager } from "./SecurityClient";

export default async function SecurityPage() {
  const session = (await getAdminSession())!;
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { mfaEnabled: true, email: true } });

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Security</h1>
      <p className="text-sm text-[var(--muted)]">
        Two-factor authentication is strongly recommended for privileged accounts. When enabled,
        you&apos;ll enter a 6-digit code from your authenticator app at login.
      </p>
      <MfaManager enabled={!!user?.mfaEnabled} />
    </div>
  );
}
