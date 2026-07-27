import { getSession } from "@/lib/auth";
import { listGoals } from "@/lib/studio-growth";
import { GoalsClient } from "./GoalsClient";

export const metadata = { title: "Goals — Riff" };

export default async function GoalsPage() {
  const session = (await getSession())!;
  return <GoalsClient initial={await listGoals(session.id)} />;
}
