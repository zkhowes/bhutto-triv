import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";

// GET - Check if current session is the admin user
export async function GET() {
  const authenticated = await isAdminAuthenticated();
  return NextResponse.json({ authenticated });
}
