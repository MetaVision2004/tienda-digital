"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireStaff } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const productSchema = z.object({
  id: z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional()),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000),
  price: z.coerce.number().finite().min(0).max(99_999_999.99),
  productType: z.enum(["download", "license", "course", "subscription"]),
  categoryId: z.preprocess((value) => value === "" ? null : Number(value), z.number().int().positive().nullable()),
  fileUrl: z.string().trim().max(1000),
  isActive: z.boolean(),
});

export async function saveProduct(formData: FormData) {
  const staff = await requireStaff(["admin", "seller"]);
  const parsed = productSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    productType: formData.get("product_type"),
    categoryId: formData.get("category_id") ?? "",
    fileUrl: formData.get("file_url") ?? "",
    isActive: formData.get("is_active") === "on",
  });
  if (!parsed.success) redirect("/admin?notice=invalid-product");

  const { id, name, description, price, productType, categoryId, fileUrl, isActive } = parsed.data;
  const values = { company_id: staff.companyId, name, description: description || null, price, product_type: productType, category_id: categoryId, file_url: fileUrl || null, is_active: isActive };
  const admin = createAdminClient();
  const result = id
    ? await admin.from("products").update(values).eq("id", id).eq("company_id", staff.companyId)
    : await admin.from("products").insert(values);
  if (result.error) redirect("/admin?notice=save-failed");
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?notice=product-saved");
}

const statusSchema = z.object({ orderId: z.uuid(), status: z.enum(["pending", "paid", "delivered", "cancelled", "refunded"]) });

export async function updateOrder(formData: FormData) {
  const staff = await requireStaff();
  const parsed = statusSchema.safeParse({ orderId: formData.get("order_id"), status: formData.get("status") });
  if (!parsed.success) redirect("/admin?notice=invalid-order");

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("customer_id").eq("id", parsed.data.orderId).maybeSingle();
  if (!order) redirect("/admin?notice=order-not-found");
  const { data: customer } = await admin.from("customers").select("id").eq("id", order.customer_id).eq("company_id", staff.companyId).maybeSingle();
  if (!customer) redirect("/admin?notice=order-not-found");

  const { error } = await admin.from("orders").update({ status: parsed.data.status }).eq("id", parsed.data.orderId);
  if (error) redirect("/admin?notice=save-failed");
  const detailsForm = [...formData.entries()].filter(([name]) => name.startsWith("licenseKey_"));
  for (const [field, rawValue] of detailsForm) {
    const detailId = field.slice("licenseKey_".length);
    if (!z.uuid().safeParse(detailId).success) continue;
    const licenseKey = String(rawValue).trim().slice(0, 500) || null;
    await admin.from("order_details").update({ license_key: licenseKey }).eq("id", detailId).eq("order_id", parsed.data.orderId);
  }
  if (parsed.data.status === "delivered") {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("order_details").update({ download_expires_at: expiresAt }).eq("order_id", parsed.data.orderId);
  }
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