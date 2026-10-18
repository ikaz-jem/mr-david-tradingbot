import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const origin = new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").origin;
  return { rules: [{ userAgent: "*", allow: ["/", "/help", "/help/category/", "/help/articles/"], disallow: ["/api/", "/admin/", "/dashboard/", "/help/search", "/login", "/register"] }], sitemap: origin + "/sitemap.xml" };
}
