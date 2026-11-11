import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, KeyRound, Layers3 } from "lucide-react";
import StaffPasswordForm from "@/components/staff-password-form";
import { getStaffSession } from "@/lib/staff-auth";

async function PasswordContent() {
  await connection();
  const staff = await getStaffSession();
  if (!staff) redirect("/admin/login?error=link-expired");

  return <main className="login-page"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><section className="login-panel"><span className="login-icon"><KeyRound size={19} /></span><span className="eyebrow">Acceso del equipo</span><h1>Elige tu contraseña.</h1><p>Usa al menos 12 caracteres. No reutilices la contraseña de otro servicio.</p><StaffPasswordForm /><Link className="text-link login-back" href="/admin/login"><ArrowLeft size={14} /> Volver al acceso</Link></section></main>;
}

export default function PasswordPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Validando acceso"><span className="brand-mark">M</span><p>Validando enlace...</p></main>}><PasswordContent /></Suspense>;
}