import { PublicNav } from "@/components/PublicNav";

// Login and signup previously rendered a bare centred card with no navigation,
// leaving no way back to the site.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      <div className="flex-1">{children}</div>
    </>
  );
}
