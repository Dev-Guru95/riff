import { redirect } from "next/navigation";

// In-app threads were retired — community lives on Skool. Route back to the gateway.
export default function ThreadRedirect() {
  redirect("/community");
}
