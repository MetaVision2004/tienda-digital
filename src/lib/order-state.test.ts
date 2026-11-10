import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus, getOrderStatusOptions } from "./order-state";

describe("order status transitions", () => {
  it.each([
    ["pending", "pending", true],
    ["pending", "paid", true],
    ["pending", "cancelled", true],
    ["pending", "delivered", false],
    ["paid", "delivered", true],
    ["paid", "refunded", true],
    ["delivered", "refunded", true],
    ["delivered", "pending", false],
    ["cancelled", "pending", false],
    ["refunded", "paid", false],
    ["unknown", "paid", false],
    ["paid", "unknown", false],
  ] as const)("allows %s -> %s: %s", (current, next, expected) => {
    expect(canTransitionOrderStatus(current, next)).toBe(expected);
  });

  it("offers only the current and reachable states", () => {
    expect(getOrderStatusOptions("pending")).toEqual(["pending", "paid", "cancelled"]);
    expect(getOrderStatusOptions("delivered")).toEqual(["delivered", "refunded"]);
    expect(getOrderStatusOptions("cancelled")).toEqual(["cancelled"]);
    expect(getOrderStatusOptions("unknown")).toEqual([]);
  });
});