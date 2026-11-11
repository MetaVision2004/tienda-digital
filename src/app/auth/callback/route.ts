import { NextResponse } from "next/server";
import { linkCustomerAccount } from "@/lib/customer-auth";
import { getStaffSession } from "@/lib/staff-auth";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["invite", "recovery", "magiclink", "signup", "email", "email_change"]);
const allowedDestinations = new Set(["/admin", "/admin/password", "/admin/security", "/cuenta", "/cuenta/password"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteUrl = getSiteUrl();
  const supabase = await createSupabaseServerClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let authError: { message: string } | null = null;

  if (code) {
    ({ error: authError } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && allowedTypes.has(type)) {
    ({ error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "invite" | "recovery" | "magiclink" | "signup" | "email" | "email_change" }));
  } else {
    authError = { message: "Invalid callback." };
  }

  if (authError) return NextResponse.redirect(new URL("/admin/login?error=link-expired", siteUrl));

  const requestedDestination = url.searchParams.get("next") ?? "/admin";
  if (requestedDestination === "/cuenta") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await linkCustomerAccount(user)) {
      return NextResponse.redirect(new URL("/cuenta/login?error=account-link-failed", siteUrl));
    }
  }

  const staff = await getStaffSession();
  if (staff) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await createAdminClient().from("users").update({ email: user.email }).eq("id", staff.id).eq("company_id", staff.companyId);
    }
  }

  const destination = allowedDestinations.has(requestedDestination) ? requestedDestination : "/admin";
  return NextResponse.redirect(new URL(destination, siteUrl));
}