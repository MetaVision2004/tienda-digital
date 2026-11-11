"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/staff-auth";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const categorySchema = z.object({
  id: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().positive().optional()),
  name: z.string().trim().min(2).max(80),
});

export async function saveCategory(formData: FormData) {
  const staff = await requireStaff(["admin", "seller"]);
  const parsed = categorySchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) redirect("/admin?notice=invalid-category");

  const admin = createAdminClient();
  const duplicateQuery = admin.from("categories").select("id").eq("company_id", staff.companyId).eq("name", parsed.data.name);
  const { data: duplicate } = parsed.data.id
    ? await duplicateQuery.neq("id", parsed.data.id).maybeSingle()
    : await duplicateQuery.maybeSingle();
  if (duplicate) redirect("/admin?notice=category-exists");

  const result = parsed.data.id
    ? await admin.from("categories").update({ name: parsed.data.name }).eq("id", parsed.data.id).eq("company_id", staff.companyId)
    : await admin.from("categories").insert({ company_id: staff.companyId, name: parsed.data.name });
  if (result.error?.code === "23505") redirect("/admin?notice=category-exists");
  if (result.error) redirect("/admin?notice=save-failed");

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?notice=category-saved");
}

const categoryIdSchema = z.object({ id: z.coerce.number().int().positive() });

export async function deleteCategory(formData: FormData) {
  const staff = await requireStaff(["admin", "seller"]);
  const parsed = categoryIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin?notice=invalid-category");

  const admin = createAdminClient();
  const { count, error: productError } = await admin.from("products").select("id", { count: "exact", head: true }).eq("company_id", staff.companyId).eq("category_id", parsed.data.id);
  if (productError) redirect("/admin?notice=save-failed");
  if (count) redirect("/admin?notice=category-in-use");

  const { data, error } = await admin.from("categories").delete().eq("id", parsed.data.id).eq("company_id", staff.companyId).select("id").maybeSingle();
  if (error) redirect("/admin?notice=save-failed");
  if (!data) redirect("/admin?notice=category-not-found");

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?notice=category-deleted");
}

const staffCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(["admin", "seller", "support"]),
});

export async function createStaff(formData: FormData) {
  const staff = await requireStaff(["admin"]);
  const parsed = staffCreateSchema.safeParse({
    fullName: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/admin?notice=invalid-staff");

  const admin = createAdminClient();
  const inviteUrl = new URL("/auth/callback?next=%2Fadmin%2Fpassword", getSiteUrl()).toString();
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: inviteUrl,
    data: { full_name: parsed.data.fullName },
  });
  if (authError || !authData.user) redirect("/admin?notice=staff-create-failed");

  const { error: staffError } = await admin.rpc("register_staff_member", {
    p_company_id: staff.companyId,
    p_user_id: authData.user.id,
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_role_name: parsed.data.role,
  });
  if (staffError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    redirect("/admin?notice=staff-create-failed");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=staff-invited");
}

const staffUpdateSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["admin", "seller", "support"]),
  isActive: z.boolean(),
});

export async function updateStaff(formData: FormData) {
  const staff = await requireStaff(["admin"]);
  const parsed = staffUpdateSchema.safeParse({
    userId: formData.get("user_id"),
    role: formData.get("role"),
    isActive: formData.get("is_active") === "on",
  });
  if (!parsed.success) redirect("/admin?notice=invalid-staff");
  if (parsed.data.userId === staff.id && !parsed.data.isActive) redirect("/admin?notice=keep-admin-active");

  const { error } = await createAdminClient().rpc("update_staff_access", {
    p_company_id: staff.companyId,
    p_user_id: parsed.data.userId,
    p_role_name: parsed.data.role,
    p_is_active: parsed.data.isActive,
  });
  if (error?.code === "P0002") redirect("/admin?notice=staff-not-found");
  if (error?.code === "23514") redirect("/admin?notice=keep-admin-active");
  if (error?.code === "22023") redirect("/admin?notice=role-not-found");
  if (error) redirect("/admin?notice=save-failed");

  revalidatePath("/admin");
  redirect("/admin?notice=staff-updated");
}
