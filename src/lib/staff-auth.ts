import { redirect } from "next/navigation";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffSession = {
  id: string;
  fullName: string;
  email: string;
  companyId: string;
  roles: string[];
};

export async function getStaffSession(): Promise<StaffSession | null> {
  const companyId = process.env.STORE_COMPANY_ID;
  if (!companyId || !hasSupabaseServerConfig()) return null;

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return null;

  const admin = createAdminClient();
  const { data: staff, error: staffError } = await admin
    .from("users")
    .select("id,company_id,full_name,email,is_active")
    .eq("id", user.id)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  if (staffError || !staff) return null;

  const { data: assignments, error: assignmentsError } = await admin
    .from("user_roles")
    .select("role_id")
    .eq("user_id", staff.id);
  if (assignmentsError || !assignments?.length) return null;

  const { data: roleRows, error: rolesError } = await admin
    .from("roles")
    .select("name")
    .in("id", assignments.map((assignment) => assignment.role_id));
  if (rolesError) return null;

  return { id: staff.id, fullName: staff.full_name, email: staff.email, companyId: staff.company_id, roles: (roleRows ?? []).map((role) => role.name) };
}

export async function requireStaff(allowedRoles: string[] = ["admin", "seller", "support"]) {
  const staff = await getStaffSession();
  if (!staff) redirect("/admin/login");
  if (!staff.roles.some((role) => allowedRoles.includes(role))) redirect("/admin/login?error=forbidden");
  return staff;
}