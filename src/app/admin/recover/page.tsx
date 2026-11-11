import Link from "next/link";
import { ArrowLeft, KeyRound, Layers3 } from "lucide-react";
import AuthEmailRequestForm from "@/components/auth-email-request-form";
import { hasSupabaseAuthConfig } from "@/lib/env";

export default function RecoverPage() {
  return <main className="login-page">
    <Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link>
    <section className="login-panel"><span className="login-icon"><KeyRound size={19} /></span><span className="eyebrow">Recuperación segura</span><h1>Restablece tu acceso.</h1><p>Te enviaremos instrucciones si el correo pertenece al equipo.</p>
      {hasSupabaseAuthConfig() ? <AuthEmailRequestForm endpoint="/api/auth/recovery" buttonLabel="Enviar instrucciones" /> : <div className="setup-message">Configura Supabase para recuperar el acceso.</div>}
      <Link className="text-link login-back" href="/admin/login"><ArrowLeft size={14} /> Volver al acceso</Link>
    </section>
  </main>;
}