import { NextResponse } from "next/server";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const companyId = process.env.STORE_COMPANY_ID;
    if (!companyId || !hasSupabaseServerConfig()) return NextResponse.json({ status: "unconfigured" }, { status: 503 });

    const { error } = await createAdminClient().from("companies").select("id", { head: true }).eq("id", companyId);
    if (error) return NextResponse.json({ status: "unavailable" }, { status: 503 });
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}