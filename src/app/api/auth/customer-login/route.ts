import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({ email: z.email().max(254).transform((email) => email.toLowerCase()), password: z.string().min(1).max(1024) });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  if (!hasSupabaseServerConfig()) return NextResponse.json({ error: "El acceso no está disponible." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 400 });

  const address = getClientAddress(request.headers);
  const ipLimit = await consumeRateLimit("customer-login-ip", address, 15, 900);
  const emailLimit = ipLimit === true ? await consumeRateLimit("customer-login-email", parsed.data.email, 8, 900) : ipLimit;
  if (ipLimit === null || emailLimit === null) return NextResponse.json({ error: "Acceso temporalmente no disponible." }, { status: 503 });
  if (!ipLimit || !emailLimit) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });

  const { data: customer, error: customerError } = await createAdminClient()
    .from("customers")
    .select("id")
    .eq("company_id", process.env.STORE_COMPANY_ID!)
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (customerError || !customer) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Esta cuenta no tiene acceso al espacio de clientes." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
