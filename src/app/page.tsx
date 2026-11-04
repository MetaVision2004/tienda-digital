import { Suspense } from "react";
import Storefront from "@/components/storefront";
import { getStorefrontData } from "@/lib/storefront-data";
import { connection } from "next/server";

async function StorefrontContent() {
  await connection();
  const { products, categories, demo } = await getStorefrontData();
  return <Storefront products={products} categories={categories} demo={demo} />;
}

export default function Home() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Cargando tienda"><span className="brand-mark">M</span><p>Preparando la colección...</p></main>}><StorefrontContent /></Suspense>;
}
