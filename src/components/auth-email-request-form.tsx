"use client";

import { useState, type FormEvent } from "react";

type AuthEmailRequestFormProps = {
  endpoint: "/api/auth/recovery" | "/api/auth/customer-recovery";
  buttonLabel: string;
};

export default function AuthEmailRequestForm({ endpoint, buttonLabel }: AuthEmailRequestFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el correo.");
      setNotice(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar el correo.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-form" onSubmit={submit}>
    <label className="form-control">Correo del equipo<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <button className="button-primary" type="submit" disabled={busy}>{busy ? "Enviando..." : buttonLabel}</button>
  </form>;
}