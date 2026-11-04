import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AdminLoginForm from "@/components/admin-login-form";
import { getStaffSession } from "@/lib/staff-auth";

async function AdminLoginContent() {
  await connection();
  const session = await getStaffSession();
  if (session) redirect("/admin");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.STORE_COMPANY_ID);
  return <AdminLoginForm configured={configured} />;
}

export default function AdminLoginPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Cargando acceso"><span className="brand-mark">M</span><p>Preparando el acceso...</p></main>}><AdminLoginContent /></Suspense>;
}