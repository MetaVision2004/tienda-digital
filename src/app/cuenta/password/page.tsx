import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, KeyRound, Layers3 } from "lucide-react";
import StaffPasswordForm from "@/components/staff-password-form";
import { getCustomerSession } from "@/lib/customer-auth";

async function CustomerPasswordContent() {
  await connection();
  const customer = await getCustomerSession();
  if (!customer) redirect("/cuenta/login?error=link-expired");
  return <main className="login-page"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><section className="login-panel"><span className="login-icon"><KeyRound size={19} /></span><span className="eyebrow">Cuenta de cliente</span><h1>Elige tu contraseña.</h1><p>Usa al menos 12 caracteres.</p><StaffPasswordForm endpoint="/api/auth/customer-password" successHref="/cuenta" /><Link className="text-link login-back" href="/cuenta/login"><ArrowLeft size={14} /> Volver al acceso</Link></section></main>;
}

export default function CustomerPasswordPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Validando acceso"><span className="brand-mark">M</span><p>Validando enlace...</p></main>}><CustomerPasswordContent /></Suspense>;
}
