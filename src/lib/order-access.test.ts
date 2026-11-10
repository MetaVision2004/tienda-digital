import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrderAccessToken, hasOrderAccessSecret, verifyOrderAccessToken } from "./order-access";

const secret = "test-secret-with-more-than-thirty-two-characters";
const orderId = "123e4567-e89b-42d3-a456-426614174000";
const originalSecret = process.env.ORDER_ACCESS_SECRET;

function signedPayload(payload: string) {
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

describe("order access tokens", () => {
  beforeEach(() => {
    process.env.ORDER_ACCESS_SECRET = secret;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ORDER_ACCESS_SECRET;
    else process.env.ORDER_ACCESS_SECRET = originalSecret;
  });

  it("signs and verifies an order id", () => {
    expect(hasOrderAccessSecret()).toBe(true);
    const token = createOrderAccessToken(orderId);
    expect(verifyOrderAccessToken(token)).toEqual({ orderId });
  });

  it("rejects the example placeholder as a signing secret", () => {
    process.env.ORDER_ACCESS_SECRET = "replace-with-at-least-32-random-characters";
    expect(hasOrderAccessSecret()).toBe(false);
    expect(() => createOrderAccessToken(orderId)).toThrow();
  });

  it("expires the token 90 days after its original issue time", () => {
    const issuedAt = Date.now() - 91 * 24 * 60 * 60 * 1000;
    expect(verifyOrderAccessToken(createOrderAccessToken(orderId, issuedAt))).toBeNull();
  });

  it.each(["", ".", "a.b.c", "a.b.extra", "eyJvcmRlcklkIjoiMSJ9.invalid"]) ("rejects malformed token %j", (token) => {
    expect(verifyOrderAccessToken(token)).toBeNull();
  });

  it("rejects a signature that does not match the payload", () => {
    const token = createOrderAccessToken(orderId);
    const [payload, signature] = token.split(".");
    const replacement = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(verifyOrderAccessToken(`${payload}.${replacement}`)).toBeNull();
  });

  it.each([
    "not-json",
    JSON.stringify({ orderId: "not-a-uuid", expiresAt: Math.floor(Date.now() / 1000) + 3600 }),
    JSON.stringify({ orderId, expiresAt: "later" }),
    JSON.stringify({ orderId, expiresAt: Math.floor(Date.now() / 1000) - 1 }),
  ])("rejects signed invalid payload %j", (payload) => {
    expect(verifyOrderAccessToken(signedPayload(payload))).toBeNull();
  });

  it("fails closed when the signing secret is missing or too short", () => {
    delete process.env.ORDER_ACCESS_SECRET;
    expect(verifyOrderAccessToken("a.b")).toBeNull();
    expect(() => createOrderAccessToken(orderId)).toThrow();
    process.env.ORDER_ACCESS_SECRET = "short";
    expect(verifyOrderAccessToken("a.b")).toBeNull();
    expect(() => createOrderAccessToken(orderId)).toThrow();
  });
});