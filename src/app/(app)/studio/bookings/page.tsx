import { requirePageSession } from "@/lib/auth";
import { listBookings } from "@/lib/studio-growth";
import { BookingsClient } from "./BookingsClient";

export const metadata = { title: "Bookings — Riff" };

export default async function BookingsPage() {
  const session = await requirePageSession();
  return <BookingsClient initial={await listBookings(session.id)} />;
}
