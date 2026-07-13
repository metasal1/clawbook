import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    // Prefer www — apex permanently redirects to www
    sitemap: "https://www.clawbook.lol/sitemap.xml",
    host: "https://www.clawbook.lol",
  };
}
