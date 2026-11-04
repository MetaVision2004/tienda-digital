export type StoreProduct = {
  id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  price: number;
  product_type: "download" | "license" | "course" | "subscription";
};

export type StoreCategory = { id: number; name: string };

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