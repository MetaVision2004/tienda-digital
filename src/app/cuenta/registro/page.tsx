import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Layers3, UserRoundPlus } from "lucide-react";
import CustomerAuthForm from "@/components/customer-auth-form";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { getCustomerSession } from "@/lib/customer-auth";

async function CustomerSignupContent() {
  const customer = await getCustomerSession();
  if (customer) redirect("/cuenta");

  return <main className="login-page"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><section className="login-panel"><span className="login-icon"><UserRoundPlus size={19} /></span><span className="eyebrow">Cuenta de cliente</span><h1>Tu cuenta empieza aquí.</h1><p>Confirma tu correo para acceder a tu espacio de cliente.</p>{hasSupabaseServerConfig() ? <CustomerAuthForm mode="signup" /> : <div className="setup-message">El registro no está disponible.</div>}<Link className="text-link login-back" href="/cuenta/login"><ArrowLeft size={14} /> Ya tengo cuenta</Link></section></main>;
}

export default function CustomerSignupPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Preparando registro"><span className="brand-mark">M</span><p>Preparando registro...</p></main>}><CustomerSignupContent /></Suspense>;
}
