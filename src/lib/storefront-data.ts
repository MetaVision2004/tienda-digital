import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreCategory, StoreProduct } from "@/lib/catalog-model";

const demoCategories: StoreCategory[] = [
  { id: 1, name: "ebooks" }, { id: 2, name: "templates" }, { id: 3, name: "courses" }, { id: 4, name: "software" },
];
const demoProducts: StoreProduct[] = [
  { id: "preview-01", category_id: 1, name: "Cuaderno de ideas", description: "Una guía breve para dar forma a proyectos que importan.", price: 18, product_type: "download" },
  { id: "preview-02", category_id: 2, name: "Sistema de marca esencial", description: "Plantillas editables para una identidad coherente.", price: 32, product_type: "download" },
  { id: "preview-03", category_id: 3, name: "Diseña tu primera web", description: "Lecciones prácticas, del boceto a la publicación.", price: 54, product_type: "course" },
  { id: "preview-04", category_id: 4, name: "Licencia Studio", description: "Herramientas para ordenar tu flujo creativo.", price: 24, product_type: "license" },
];

export async function getStorefrontData() {
  const companyId = process.env.STORE_COMPANY_ID;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && companyId);
  if (!configured || !companyId) return { products: demoProducts, categories: demoCategories, demo: true };

  const supabase = createAdminClient();
  const [productResult, categoryResult] = await Promise.all([
    supabase.from("products").select("id,category_id,name,description,price,product_type").eq("company_id", companyId).eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name").order("name"),
  ]);
  if (productResult.error) throw new Error("No fue posible cargar el catálogo.");
  if (categoryResult.error) throw new Error("No fue posible cargar las categorías.");

  return {
    products: (productResult.data ?? []).map((product) => ({ ...product, price: Number(product.price) })) as StoreProduct[],
    categories: (categoryResult.data ?? []) as StoreCategory[],
    demo: false,
  };
}