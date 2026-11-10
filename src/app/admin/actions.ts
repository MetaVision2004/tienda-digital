"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireStaff } from "@/lib/staff-auth";
import { orderStatuses } from "@/lib/order-state";
import { isCompanyStoragePath } from "@/lib/storage-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const productSchema = z.object({
  id: z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional()),
  name: z.string().trim().min(2).max(120),
  slug: z.union([z.literal(""), z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160)]),
  description: z.string().trim().max(2000),
  price: z.coerce.number().finite().min(0).max(99_999_999.99),
  compareAtPrice: z.preprocess((value) => value === "" || value === null ? null : Number(value), z.number().finite().min(0).nullable()),
  imageUrl: z.union([z.literal(""), z.url().refine((value) => value.startsWith("https://"))]),
  productType: z.enum(["download", "license", "course", "subscription"]),
  categoryId: z.preprocess((value) => value === "" ? null : Number(value), z.number().int().positive().nullable()),
  fileUrl: z.string().trim().max(1000),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  isActive: z.boolean(),
}).superRefine((product, context) => {
  if (product.compareAtPrice !== null && product.compareAtPrice <= product.price) {
    context.addIssue({ code: "custom", path: ["compareAtPrice"], message: "El precio anterior debe ser mayor que el precio actual." });
  }
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160) || "producto";
}

export async function saveProduct(formData: FormData) {
  const staff = await requireStaff(["admin", "seller"]);
  const parsed = productSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    compareAtPrice: formData.get("compare_at_price"),
    imageUrl: formData.get("image_url") ?? "",
    productType: formData.get("product_type"),
    categoryId: formData.get("category_id") ?? "",
    fileUrl: formData.get("file_url") ?? "",
    isFeatured: formData.get("is_featured") === "on",
    isNew: formData.get("is_new") === "on",
    isActive: formData.get("is_active") === "on",
  });
  if (!parsed.success) redirect("/admin?notice=invalid-product");

  const { id, name, description, price, compareAtPrice, imageUrl, productType, categoryId, fileUrl, isFeatured, isNew, isActive } = parsed.data;
  const slug = parsed.data.slug || slugify(name);
  if (fileUrl && !isCompanyStoragePath(fileUrl, staff.companyId)) redirect("/admin?notice=invalid-product");
  const admin = createAdminClient();
  if (categoryId !== null) {
    const { data: category } = await admin.from("categories").select("id").eq("id", categoryId).eq("company_id", staff.companyId).maybeSingle();
    if (!category) redirect("/admin?notice=invalid-product");
  }
  const values = { company_id: staff.companyId, name, slug, description: description || null, price, compare_at_price: compareAtPrice, image_url: imageUrl || null, is_featured: isFeatured, is_new: isNew, product_type: productType, category_id: categoryId, file_url: fileUrl || null, is_active: isActive };
  const result = id
    ? await admin.from("products").update(values).eq("id", id).eq("company_id", staff.companyId)
    : await admin.from("products").insert(values);
  if (result.error) redirect(`/admin?notice=${result.error.code === "23505" ? "slug-taken" : "save-failed"}`);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?notice=product-saved");
}

const statusSchema = z.object({ orderId: z.uuid(), status: z.enum(orderStatuses) });

export async function updateOrder(formData: FormData) {
  const staff = await requireStaff(["admin", "seller"]);
  const parsed = statusSchema.safeParse({ orderId: formData.get("order_id"), status: formData.get("status") });
  if (!parsed.success) redirect("/admin?notice=invalid-order");

  const admin = createAdminClient();
  const licenseKeys = [...formData.entries()].filter(([name]) => name.startsWith("licenseKey_")).map(([field, rawValue]) => {
    const detailId = field.slice("licenseKey_".length);
    if (!z.uuid().safeParse(detailId).success) return null;
    return { detailId, licenseKey: String(rawValue).trim().slice(0, 500) };
  });
  if (licenseKeys.some((item) => item === null)) redirect("/admin?notice=invalid-order");

  const { error } = await admin.rpc("update_order_with_details", {
    p_company_id: staff.companyId,
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
    p_license_keys: licenseKeys,
  });
  if (error?.code === "P0002") redirect("/admin?notice=order-not-found");
  if (error?.code === "23514" || error?.code === "22023") redirect("/admin?notice=invalid-order");
  if (error) redirect("/admin?notice=save-failed");
  revalidatePath("/admin");
  revalidatePath("/", "page");
  redirect("/admin?notice=order-updated");
}

export async function uploadProductFile(formData: FormData) {
  const staff = await requireStaff(["admin", "seller"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo primero." };
  if (file.size > 25 * 1024 * 1024) return { error: "El archivo supera el límite de 25 MB." };

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "digital-products";
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "download";
  const path = `${staff.companyId}/${randomUUID()}-${safeName}`;
  const { error } = await createAdminClient().storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { error: "No se pudo subir el archivo. Revisa el bucket privado y su límite de tamaño." };
  return { path };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}