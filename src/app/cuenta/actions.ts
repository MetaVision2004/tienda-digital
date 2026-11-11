"use server";

import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/customer-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOutCustomer() {
  await requireCustomer();
  await (await createSupabaseServerClient()).auth.signOut();
  redirect("/cuenta/login");
}
