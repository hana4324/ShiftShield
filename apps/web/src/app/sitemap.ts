import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/legal-docs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-20");
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...LEGAL_DOCS.map((d) => ({
      url: `${siteUrl}/legal/${d.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
