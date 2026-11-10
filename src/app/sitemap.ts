import type { MetadataRoute } from "next";
import { getStorefrontData } from "@/lib/storefront-data";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const { products } = await getStorefrontData();

  return [
    { url: new URL("/", siteUrl).toString(), changeFrequency: "daily", priority: 1 },
    ...products.map((product) => ({
      url: new URL(`/producto/${product.slug}`, siteUrl).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}