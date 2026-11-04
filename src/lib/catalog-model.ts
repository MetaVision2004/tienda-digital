export type StoreProduct = {
  id: string;
  category_id: number | null;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_new: boolean;
  product_type: "download" | "license" | "course" | "subscription";
};

export type StoreCategory = { id: number; name: string };

export function safeImageUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function formatCurrency(amount: number) {
  const currency = process.env.NEXT_PUBLIC_STORE_CURRENCY || "USD";
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(amount);
}

export function categoryLabel(name: string) {
  const labels: Record<string, string> = {
    ebooks: "E-books",
    templates: "Plantillas",
    courses: "Cursos",
    software: "Software",
  };
  return labels[name.toLowerCase()] ?? name;
}