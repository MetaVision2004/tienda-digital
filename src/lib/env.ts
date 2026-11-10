import { z } from "zod";

const urlSchema = z.url();

export function isConfiguredValue(value: string | undefined): value is string {
  const normalized = value?.trim();
  return Boolean(normalized && !/^replace[-_]/i.test(normalized));
}

export function hasSupabaseAuthConfig() {
  return urlSchema.safeParse(process.env.NEXT_PUBLIC_SUPABASE_URL).success
    && isConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
