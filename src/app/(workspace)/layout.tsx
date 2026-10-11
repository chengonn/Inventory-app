import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/auth/guard";
import { mutationsBlocked } from "@/lib/deployment";
// Auth refresh responses must never be stored as static/ISR pages.
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requirePageActor();
  return <AppShell>{process.env.INVENTORY_DEMO === "true" && <p className="mb-4 rounded border border-teal-300 bg-teal-50 p-3">作品展示版：請只輸入虛構資料。可從「新增品項與庫存」開始體驗，再操作入庫、出庫與盤點。</p>}{mutationsBlocked() && <p role="status" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3">此環境僅供查詢，新增、修改與匯入已停用。</p>}{children}</AppShell>;
}
