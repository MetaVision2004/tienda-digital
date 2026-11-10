import "server-only";
import { z } from "zod";
import { hasSupabaseAuthConfig, isConfiguredValue } from "@/lib/env";

const uuidSchema = z.uuid();

export function hasSupabaseServerConfig() {
  return hasSupabaseAuthConfig()
    && isConfiguredValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
    && uuidSchema.safeParse(process.env.STORE_COMPANY_ID).success;
}