import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/panier", "/commande", "/compte", "/suivi", "/recherche"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
