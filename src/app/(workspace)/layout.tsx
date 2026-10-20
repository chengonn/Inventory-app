import { getT } from "@/lib/i18n/server";
import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/auth/guard";
import { mutationsBlocked } from "@/lib/deployment";
// Auth refresh responses must never be stored as static/ISR pages.
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getT();

  const actor = await requirePageActor();
  return (
    <AppShell guest={actor.role === "guest"}>
      {actor.role === "guest" && (
        <p className="mb-4 rounded border p-3">
          {t(
            "訪客體驗：共用虛構資料；可建檔、入出庫與盤點，禁止管理、沖銷及匯出。登入有效期最長 20 分鐘，到期請重新登入。",
          )}
        </p>
      )}
      {process.env.INVENTORY_DEMO === "true" && (
        <p className="mb-4 rounded border border-teal-300 bg-teal-50 p-3">
          {t(
            "作品展示版：請只輸入虛構資料。可從「新增品項與庫存」開始體驗，再操作入庫、出庫與盤點。",
          )}
        </p>
      )}
      {mutationsBlocked() && (
        <p
          role="status"
          className="mb-4 rounded border border-amber-300 bg-amber-50 p-3"
        >
          {t("此環境僅供查詢，新增、修改與匯入已停用。")}
        </p>
      )}
      {children}
    </AppShell>
  );
}
