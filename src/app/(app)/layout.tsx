import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserNav } from "@/components/UserNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isAdmin = ["admin", "reviewer", "moderator"].includes(session.role);

  // Stage name and plan for the sidebar footer. One read, both relations.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      profile: { select: { stageName: true } },
      subscription: { select: { plan: true } },
    },
  });

  // Column below lg (nav is a top bar), row from lg up (nav is a sidebar).
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <UserNav
        email={session.email}
        name={user?.profile?.stageName ?? undefined}
        plan={user?.subscription?.plan ?? "free"}
        isAdmin={isAdmin}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
