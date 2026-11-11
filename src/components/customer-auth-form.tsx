"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function CustomerAuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const body = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch(mode === "signup" ? "/api/auth/customer-signup" : "/api/auth/customer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo completar la solicitud.");
      if (mode === "signup") {
        setNotice(result.message);
        event.currentTarget.reset();
        return;
      }
      router.replace("/cuenta");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-form" onSubmit={submit}>
    {mode === "signup" && <label className="form-control">Nombre completo<input name="fullName" autoComplete="name" required minLength={2} maxLength={120} /></label>}
    <label className="form-control">Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="form-control">Contraseña<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 12 : 1} maxLength={128} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <button className="button-primary" type="submit" disabled={busy}>{busy ? "Procesando..." : mode === "signup" ? "Crear cuenta" : "Iniciar sesión"}</button>
    {mode === "login" ? <Link className="text-link" href="/cuenta/recover">Olvidé mi contraseña</Link> : <small>Te enviaremos un correo para confirmar tu cuenta antes de iniciar sesión.</small>}
  </form>;
}
