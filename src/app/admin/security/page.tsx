import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Layers3, ShieldCheck } from "lucide-react";
import StaffSecurityForm from "@/components/staff-security-form";
import { requireStaff } from "@/lib/staff-auth";

async function AccountSecurityContent() {
  await connection();
  const staff = await requireStaff();

  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>gestión de tienda</small></span></Link><Link className="text-link" href="/admin"><ArrowLeft size={14} /> Volver al panel</Link></header><div className="admin-content"><div className="admin-title-row"><div><span className="eyebrow"><ShieldCheck size={14} /> Seguridad de la cuenta</span><h1>Protege tu acceso.</h1><p>{staff.email}</p></div></div><StaffSecurityForm currentEmail={staff.email} /></div></main>;
}

export default function AccountSecurityPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Validando sesión"><span className="brand-mark">M</span><p>Validando sesión...</p></main>}><AccountSecurityContent /></Suspense>;
}