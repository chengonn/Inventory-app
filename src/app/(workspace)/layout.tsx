import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/auth/guard";
// Auth refresh responses must never be stored as static/ISR pages.
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requirePageActor();
  return <AppShell>{children}</AppShell>;
}
