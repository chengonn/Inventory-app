import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/auth/guard";
import { mutationsBlocked } from "@/lib/deployment";
// Auth refresh responses must never be stored as static/ISR pages.
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requirePageActor();
  return <AppShell>{mutationsBlocked() && <p role="status" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3">此環境僅供查詢，新增、修改與匯入已停用。</p>}{children}</AppShell>;
}
