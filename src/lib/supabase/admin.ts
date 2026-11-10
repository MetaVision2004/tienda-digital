import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isConfiguredValue } from "@/lib/env";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isConfiguredValue(url) || !isConfiguredValue(serviceKey)) throw new Error("Faltan las variables privadas de Supabase.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}