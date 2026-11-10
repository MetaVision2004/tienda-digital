"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, KeyRound, Layers3 } from "lucide-react";

export default function AdminLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión.");
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link>
    <section className="login-panel">
      <span className="login-icon"><KeyRound size={19} /></span>
      <span className="eyebrow">Espacio del equipo</span>
      <h1>Qué bueno tenerte de vuelta.</h1>
      <p>Entra para revisar pedidos y mantener la colección al día.</p>
      {configured ? <form className="admin-form" onSubmit={signIn}>
        <label className="form-control">Correo del equipo<input name="email" type="email" autoComplete="username" required /></label>
        <label className="form-control">Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "Verificando..." : "Iniciar sesión"}<ArrowRight size={15} /></button>
      </form> : <div className="setup-message">Configura las variables de Supabase en `.env.local` para habilitar el acceso del equipo.</div>}
      <Link className="text-link login-back" href="/">Volver a la tienda <ArrowRight size={14} /></Link>
    </section>
  </main>;
}