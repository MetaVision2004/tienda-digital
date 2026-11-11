import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const changeEmailSchema = z.object({ currentPassword: z.string().min(1).max(1024), newEmail: z.email().max(254).transform((email) => email.toLowerCase()) });

export async function POST(request: Request) {
  const staff = await getStaffSession();
  if (!staff) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const rateLimit = await consumeRateLimit("email-update", staff.id, 3, 3600);
  if (rateLimit === null) return NextResponse.json({ error: "Cambio de correo temporalmente no disponible." }, { status: 503 });
  if (!rateLimit) return NextResponse.json({ error: "Demasiados intentos. Espera antes de volver a intentarlo." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = changeEmailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revisa el correo y la contraseña actual." }, { status: 400 });
  if (parsed.data.newEmail === staff.email.toLowerCase()) return NextResponse.json({ error: "Ese ya es tu correo actual." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: staff.email, password: parsed.data.currentPassword });
  if (reauthError) return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 401 });

  const redirectTo = new URL("/auth/callback?next=%2Fadmin%2Fsecurity", getSiteUrl()).toString();
  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail }, { emailRedirectTo: redirectTo });
  if (error) return NextResponse.json({ error: "No se pudo iniciar el cambio de correo." }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Confirma el cambio desde los correos enviados a tus direcciones actual y nueva." });
}