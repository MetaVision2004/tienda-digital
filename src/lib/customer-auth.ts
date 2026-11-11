import "server-only";
import { redirect } from "next/navigation";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type CustomerSession = {
  id: string;
  userId: string;
  companyId: string;
  fullName: string;
  email: string;
};

export async function linkCustomerAccount(user: AuthUser): Promise<CustomerSession | null> {
  const companyId = process.env.STORE_COMPANY_ID;
  const email = user.email?.trim().toLowerCase();
  if (!companyId || !email || !hasSupabaseServerConfig()) return null;

  const fullNameValue = user.user_metadata?.full_name;
  const fullName = typeof fullNameValue === "string" && fullNameValue.trim().length >= 2
    ? fullNameValue.trim().slice(0, 120)
    : email.split("@")[0].slice(0, 120);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("customers")
    .select("id,auth_user_id,full_name,email")
    .eq("company_id", companyId)
    .eq("email", email)
    .maybeSingle();
  if (existingError) return null;

  if (existing?.auth_user_id && existing.auth_user_id !== user.id) return null;

  const result = existing
    ? await admin.from("customers").update({ auth_user_id: user.id, full_name: fullName, email }).eq("id", existing.id).eq("company_id", companyId).select("id,full_name,email").single()
    : await admin.from("customers").insert({ company_id: companyId, auth_user_id: user.id, full_name: fullName, email }).select("id,full_name,email").single();
  if (result.error || !result.data) return null;

  return { id: result.data.id, userId: user.id, companyId, fullName: result.data.full_name, email: result.data.email };
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const companyId = process.env.STORE_COMPANY_ID;
  if (!companyId || !hasSupabaseServerConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) return null;

  const { data: customer, error } = await createAdminClient()
    .from("customers")
    .select("id,company_id,auth_user_id,full_name,email")
    .eq("company_id", companyId)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || !customer) return null;

  return { id: customer.id, userId: user.id, companyId: customer.company_id, fullName: customer.full_name, email: customer.email };
}

export async function requireCustomer() {
  const customer = await getCustomerSession();
  if (!customer) redirect("/cuenta/login");
  return customer;
}
