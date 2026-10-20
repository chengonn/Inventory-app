import "server-only";
import type { Actor } from "./policy";
import { MoveError } from "@/lib/moves/validation";

export function isGuest(actor: Actor | undefined) {
  return actor?.role === "guest";
}

export function requireManager(actor: Actor) {
  if (isGuest(actor))
    throw new MoveError("訪客可體驗建檔、入出庫與盤點；此功能僅供管理者使用。");
}
