import { requirePageSession } from "@/lib/auth";
import { listFinance } from "@/lib/studio-tools";
import { FinanceClient } from "./FinanceClient";

export const metadata = { title: "Revenue & Budget — Riff" };

export default async function FinancePage() {
  const session = await requirePageSession();
  const data = await listFinance(session.id);
  return <FinanceClient initial={data} />;
}
