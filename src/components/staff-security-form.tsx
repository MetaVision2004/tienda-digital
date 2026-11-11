"use client";

import { useState, type FormEvent } from "react";

export default function StaffSecurityForm({ currentEmail }: { currentEmail: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reauthRequested, setReauthRequested] = useState(false);

  async function requestReauthentication() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/reauthenticate", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el código.");
      setReauthRequested(true);
      setNotice(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    if (password !== formData.get("confirmPassword")) {
      setError("Las contraseñas no coinciden.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, nonce: formData.get("nonce") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo cambiar la contraseña.");
      setNotice("Contraseña actualizada.");
      setReauthRequested(false);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: formData.get("currentPassword"), newEmail: formData.get("newEmail") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo solicitar el cambio de correo.");
      setNotice(result.message);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo solicitar el cambio de correo.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="security-forms">
    <div className="security-panel"><div><h2>Cambiar contraseña</h2><p>Enviaremos un código de verificación a {currentEmail}.</p></div><button className="button-quiet" type="button" onClick={requestReauthentication} disabled={busy}>{busy ? "Enviando..." : "Enviar código"}</button>
      {reauthRequested && <form className="admin-form" onSubmit={updatePassword}><label className="form-control">Código de verificación<input name="nonce" inputMode="numeric" autoComplete="one-time-code" required maxLength={128} /></label><label className="form-control">Nueva contraseña<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="form-control">Confirmar contraseña<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><button className="button-primary" type="submit" disabled={busy}>{busy ? "Guardando..." : "Actualizar contraseña"}</button></form>}
    </div>
    <div className="security-panel"><div><h2>Cambiar correo</h2><p>Se requiere tu contraseña actual y confirmación de ambas direcciones.</p></div><form className="admin-form" onSubmit={updateEmail}><label className="form-control">Correo nuevo<input name="newEmail" type="email" autoComplete="email" required maxLength={254} /></label><label className="form-control">Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} /></label><button className="button-primary" type="submit" disabled={busy}>{busy ? "Verificando..." : "Solicitar cambio de correo"}</button></form></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
  </div>;
}