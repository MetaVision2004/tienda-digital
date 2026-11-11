"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function StaffPasswordForm({ endpoint = "/api/auth/password", successHref = "/admin" }: { endpoint?: "/api/auth/password" | "/api/auth/customer-password"; successHref?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    if (password !== formData.get("confirmPassword")) {
      setError("Las contraseñas no coinciden.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la contraseña.");
      router.replace(successHref);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-form" onSubmit={submit}>
    <label className="form-control">Nueva contraseña<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
    <label className="form-control">Confirmar contraseña<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button-primary" type="submit" disabled={busy}>{busy ? "Guardando..." : "Establecer contraseña"}</button>
  </form>;
}