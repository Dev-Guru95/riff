import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLinkPage } from "@/lib/studio-growth";

// PUBLIC, unauthenticated page — sits outside the (app) auth layout.
const VAR: Record<string, string> = { brand: "#8b5cf6", "brand-2": "#ec4899", accent: "#22d3ee", success: "#34d399", warning: "#fbbf24" };
const safe = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const page = await getPublicLinkPage(handle);
  return { title: page ? `${page.title} — Links` : "Links" };
}

export default async function PublicLinkPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const page = await getPublicLinkPage(handle);
  if (!page) notFound();
  const color = VAR[page.theme] ?? VAR.brand;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", color: "#ededf2", display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        <div style={{ height: 88, width: 88, borderRadius: "50%", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 34, fontWeight: 700, color: "#fff", background: color }}>
          {(page.title || "A")[0]?.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 16 }}>{page.title || "Artist"}</h1>
        {page.bio && <p style={{ color: "#9a9ab0", marginTop: 8, fontSize: 14 }}>{page.bio}</p>}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {page.links.filter((l) => l.url).map((l, i) => (
            <a key={i} href={safe(l.url)} target="_blank" rel="noopener noreferrer nofollow"
              style={{ display: "block", padding: "14px", borderRadius: 12, border: `1px solid ${color}`, color: "#ededf2", textDecoration: "none", fontWeight: 600, fontSize: 15, transition: "background 0.15s" }}>
              {l.label || l.url}
            </a>
          ))}
        </div>
        <div style={{ marginTop: 40, fontSize: 11, color: "#5a5a6a" }}>Made with Riff</div>
      </div>
    </main>
  );
}
