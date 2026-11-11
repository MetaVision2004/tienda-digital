import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  if (!hasSupabaseServerConfig()) return NextResponse.json({ error: "El registro no está disponible." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre, correo y contraseña. La contraseña requiere 12 caracteres." }, { status: 400 });

  const address = getClientAddress(request.headers);
  const ipLimit = await consumeRateLimit("customer-signup-ip", address, 5, 3600);
  const emailLimit = ipLimit === true ? await consumeRateLimit("customer-signup-email", parsed.data.email, 3, 86400) : ipLimit;
  if (ipLimit === null || emailLimit === null) return NextResponse.json({ error: "El registro está temporalmente no disponible." }, { status: 503 });
  if (!ipLimit || !emailLimit) return NextResponse.json({ error: "Demasiados intentos. Prueba más tarde." }, { status: 429 });

  const redirectTo = new URL("/auth/callback?next=%2Fcuenta", getSiteUrl()).toString();
  const supabase = await createSupabaseServerClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser) return NextResponse.json({ error: "Cierra la sesión actual antes de crear una cuenta de cliente." }, { status: 409 });

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: redirectTo, data: { full_name: parsed.data.fullName } },
  });
  if (error) console.error(JSON.stringify({ event: "customer_signup_failed", code: error.code }));

  return NextResponse.json({ ok: true, message: "Si el registro puede continuar, recibirás un correo para confirmar tu cuenta." });
}
