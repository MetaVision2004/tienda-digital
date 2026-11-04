"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { uploadProductFile } from "@/app/admin/actions";

export default function ProductFileInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [path, setPath] = useState(defaultValue);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return setMessage("Selecciona un archivo primero.");
    setBusy(true);
    setMessage("");
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadProductFile(formData);
    if (result.path) {
      setPath(result.path);
      setFile(null);
      setMessage("Archivo subido.");
    } else {
      setMessage(result.error ?? "No se pudo subir el archivo.");
    }
    setBusy(false);
  }

  return <div className="file-input-control"><input name="file_url" value={path} onChange={(event) => setPath(event.target.value)} placeholder="Ruta en Storage (carpeta/archivo.pdf)" maxLength={1000} aria-label="Ruta del archivo digital" /><div className="file-upload-row"><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} aria-label="Seleccionar archivo digital" /><button className="button-quiet" type="button" onClick={upload} disabled={busy}>{busy ? "Subiendo..." : "Subir archivo"}<FileUp size={14} /></button></div>{message && <small role="status">{message}</small>}</div>;
}