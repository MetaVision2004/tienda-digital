import { createHmac } from "node:crypto";
import { isConfiguredValue } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export function getClientAddress(requestHeaders: Headers) {
  return requestHeaders.get("x-vercel-forwarded-for")
    ?? requestHeaders.get("x-real-ip")
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function consumeRateLimit(scope: string, identifier: string, limit: number, windowSeconds: number) {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.ORDER_ACCESS_SECRET;
  if (!isConfiguredValue(secret) || secret.length < 32) return null;

  const keyHash = createHmac("sha256", secret).update(`${scope}:${identifier}`).digest("hex");
  let data: unknown;
  let error: { message: string } | null;
  try {
    ({ data, error } = await createAdminClient().rpc("consume_rate_limit", {
      p_key_hash: keyHash,
      p_max_requests: limit,
      p_window_seconds: windowSeconds,
    }));
  } catch {
    return null;
  }

  if (error || typeof data !== "boolean") return null;
  return data;
}