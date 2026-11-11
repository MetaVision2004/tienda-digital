import Link from "next/link";
import { ArrowLeft, KeyRound, Layers3 } from "lucide-react";
import AuthEmailRequestForm from "@/components/auth-email-request-form";
import { hasSupabaseServerConfig } from "@/lib/env-server";

export default function CustomerRecoverPage() {
  return <main className="login-page"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><section className="login-panel"><span className="login-icon"><KeyRound size={19} /></span><span className="eyebrow">Recuperación segura</span><h1>Restablece tu acceso.</h1><p>Te enviaremos instrucciones si existe una cuenta con ese correo.</p>{hasSupabaseServerConfig() ? <AuthEmailRequestForm endpoint="/api/auth/customer-recovery" buttonLabel="Enviar instrucciones" /> : <div className="setup-message">La recuperación no está disponible.</div>}<Link className="text-link login-back" href="/cuenta/login"><ArrowLeft size={14} /> Volver al acceso</Link></section></main>;
}
