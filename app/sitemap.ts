import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";
import { MODULES } from "@/modules/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const productPages = MODULES.filter((m) => m.status === "available" && m.marketing).map((m) => m.marketing!.href);
  return ["/", ...productPages, "/contact", "/privacy", "/terms"].map((path) => ({ url: appUrl(path), changeFrequency: "monthly", priority: path === "/" ? 1 : 0.5 }));
}
