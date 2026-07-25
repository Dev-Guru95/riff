import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TopNav } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isAdmin = ["admin", "reviewer", "moderator"].includes(session.role);
  return (
    <>
      <TopNav email={session.email} isAdmin={isAdmin} />
      <div className="flex-1">{children}</div>
    </>
  );
}
