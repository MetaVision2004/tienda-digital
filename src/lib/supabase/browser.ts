"use client";

import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseAuthConfig, isConfiguredValue } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isConfiguredValue(url) || !isConfiguredValue(anonKey) || !hasSupabaseAuthConfig()) throw new Error("Configura Supabase antes de iniciar sesión.");
  return createBrowserClient(url, anonKey);
}