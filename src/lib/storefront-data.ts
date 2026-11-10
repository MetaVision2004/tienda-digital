import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import type { StoreCategory, StoreProduct } from "@/lib/catalog-model";

const demoCategories: StoreCategory[] = [
  { id: 1, name: "ebooks" }, { id: 2, name: "templates" }, { id: 3, name: "courses" }, { id: 4, name: "software" },
];
const demoProducts: StoreProduct[] = [
  { id: "preview-01", category_id: 1, slug: "cuaderno-de-ideas", name: "Cuaderno de ideas", description: "Una guía breve para dar forma a proyectos que importan.", price: 18, compare_at_price: 24, image_url: null, is_featured: true, is_new: false, product_type: "download" },
  { id: "preview-02", category_id: 2, slug: "sistema-de-marca-esencial", name: "Sistema de marca esencial", description: "Plantillas editables para una identidad coherente.", price: 32, compare_at_price: null, image_url: null, is_featured: false, is_new: true, product_type: "download" },
  { id: "preview-03", category_id: 3, slug: "disena-tu-primera-web", name: "Diseña tu primera web", description: "Lecciones prácticas, del boceto a la publicación.", price: 54, compare_at_price: null, image_url: null, is_featured: false, is_new: false, product_type: "course" },
  { id: "preview-04", category_id: 4, slug: "licencia-studio", name: "Licencia Studio", description: "Herramientas para ordenar tu flujo creativo.", price: 24, compare_at_price: null, image_url: null, is_featured: false, is_new: false, product_type: "license" },
];

export async function getStorefrontData() {
  const companyId = process.env.STORE_COMPANY_ID;
  const configured = hasSupabaseServerConfig() && Boolean(companyId);
  if (!configured || !companyId) return { products: demoProducts, categories: demoCategories, demo: true };

  const supabase = createAdminClient();
  const [productResult, categoryResult] = await Promise.all([
    supabase.from("products").select("id,category_id,slug,name,description,price,compare_at_price,image_url,is_featured,is_new,product_type").eq("company_id", companyId).eq("is_active", true).order("is_featured", { ascending: false }).order("is_new", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name").eq("company_id", companyId).order("name"),
  ]);
  if (productResult.error) throw new Error("No fue posible cargar el catálogo.");
  if (categoryResult.error) throw new Error("No fue posible cargar las categorías.");

  return {
    products: (productResult.data ?? []).map((product) => ({ ...product, price: Number(product.price), compare_at_price: product.compare_at_price === null ? null : Number(product.compare_at_price) })) as StoreProduct[],
    categories: (categoryResult.data ?? []) as StoreCategory[],
    demo: false,
  };
}

export async function getProductBySlug(slug: string) {
  const companyId = process.env.STORE_COMPANY_ID;
  const configured = hasSupabaseServerConfig() && Boolean(companyId);
  if (!configured || !companyId) return demoProducts.find((product) => product.slug === slug) ?? null;

  const { data, error } = await createAdminClient()
    .from("products")
    .select("id,category_id,slug,name,description,price,compare_at_price,image_url,is_featured,is_new,product_type")
    .eq("company_id", companyId)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("No fue posible cargar el producto.");
  if (!data) return null;
  return { ...data, price: Number(data.price), compare_at_price: data.compare_at_price === null ? null : Number(data.compare_at_price) } as StoreProduct;
}