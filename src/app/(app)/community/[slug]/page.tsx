import { redirect } from "next/navigation";

// In-app forums were retired — community lives on Skool. Route back to the gateway.
export default function ForumRedirect() {
  redirect("/community");
}
