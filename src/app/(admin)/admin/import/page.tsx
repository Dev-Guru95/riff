import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { ImportClient } from "./ImportClient";

export default async function ImportCoursePage() {
  // Layout already gates admin access; re-check so this page is safe in isolation.
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return <ImportClient />;
}
