import { createHmac, timingSafeEqual } from "node:crypto";
import { isConfiguredValue } from "./env";

const tokenLifetimeSeconds = 90 * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.ORDER_ACCESS_SECRET;
  if (!isConfiguredValue(secret) || secret.length < 32) return null;
  return secret;
}

export function hasOrderAccessSecret() {
  return getSecret() !== null;
}

export function createOrderAccessToken(orderId: string, issuedAt = Date.now()) {
  const secret = getSecret();
  if (!secret) throw new Error("ORDER_ACCESS_SECRET debe tener al menos 32 caracteres.");

  const payload = Buffer.from(JSON.stringify({ orderId, expiresAt: Math.floor(issuedAt / 1000) + tokenLifetimeSeconds })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOrderAccessToken(token: string) {
  const secret = getSecret();
  if (!secret) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data !== "object" || data === null || !("orderId" in data) || !("expiresAt" in data)) return null;
    const { orderId, expiresAt } = data as { orderId: unknown; expiresAt: unknown };
    if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return null;
    if (typeof expiresAt !== "number" || expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { orderId };
  } catch {
    return null;
  }
}