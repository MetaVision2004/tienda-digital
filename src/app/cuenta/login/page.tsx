import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Layers3, UserRound } from "lucide-react";
import CustomerAuthForm from "@/components/customer-auth-form";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { getCustomerSession } from "@/lib/customer-auth";

async function CustomerLoginContent() {
  const customer = await getCustomerSession();
  if (customer) redirect("/cuenta");

  return <main className="login-page"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><section className="login-panel"><span className="login-icon"><UserRound size={19} /></span><span className="eyebrow">Tu espacio</span><h1>Qué bueno verte.</h1><p>Inicia sesión para consultar tus pedidos.</p>{hasSupabaseServerConfig() ? <CustomerAuthForm mode="login" /> : <div className="setup-message">El acceso a clientes no está disponible.</div>}<Link className="text-link login-back" href="/cuenta/registro">Crear cuenta <ArrowLeft size={14} /></Link><Link className="text-link login-back" href="/">Volver a la tienda <ArrowLeft size={14} /></Link></section></main>;
}

export default function CustomerLoginPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Validando cuenta"><span className="brand-mark">M</span><p>Validando cuenta...</p></main>}><CustomerLoginContent /></Suspense>;
}
