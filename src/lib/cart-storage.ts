"use client";

import { useSyncExternalStore } from "react";

export const cartStorageKey = "marea-digital-cart";
const cartUpdatedEvent = "marea-cart-updated";

function parseCart(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] =>
        typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] > 0 && entry[1] <= 10,
      ),
    );
  } catch {
    return {};
  }
}

function getSnapshot() {
  return localStorage.getItem(cartStorageKey) ?? "{}";
}

function getServerSnapshot() {
  return "{}";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(cartUpdatedEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(cartUpdatedEvent, callback);
  };
}

export function useCart() {
  return parseCart(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));
}

export function writeCart(cart: Record<string, number>) {
  localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  window.dispatchEvent(new Event(cartUpdatedEvent));
}

export function addCartItem(productId: string) {
  const cart = parseCart(getSnapshot());
  cart[productId] = Math.min((cart[productId] ?? 0) + 1, 10);
  writeCart(cart);
}

export function changeCartItem(productId: string, delta: number) {
  const cart = parseCart(getSnapshot());
  const quantity = (cart[productId] ?? 0) + delta;
  if (quantity <= 0) delete cart[productId];
  else cart[productId] = Math.min(quantity, 10);
  writeCart(cart);
}

export function clearCart() {
  writeCart({});
}