import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyActor } from "./policy";

/** Call again at every page/data entry; a layout alone cannot guard mutations. */
export async function requirePageActor() {
  const result = await verifyActor(await createClient());
  if (result.status !== "allowed" || !result.actor) {
    redirect(result.status === "anonymous" ? "/login" : `/login?reason=${result.status}`);
  }
  return result.actor;
}
