import { MoveError } from "./validation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { SearchParams } from "@/lib/inventory/read-model";
export function moveFilters(params: SearchParams) {
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string).trim() : "";
  const q = value("q").slice(0, 100),
    type = value("type"),
    status = value("status"),
    from = value("from"),
    to = value("to");
  const valid = z
    .object({
      q: z.string().max(100),
      type: z.enum(["", "IN", "OUT", "ADJUST_GAIN", "ADJUST_LOSS", "REVERSAL"]),
      status: z.enum(["", "CONFIRMED", "NEEDS_REVIEW", "IGNORED"]),
      from: z.string().max(10),
      to: z.string().max(10),
    })
    .safeParse({ q, type, status, from, to });
  if (!valid.success) throw new MoveError("異動篩選欄位格式無效。");
  const date = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
      throw new MoveError("日期格式須為 YYYY-MM-DD。");
    const utc = new Date(`${s}T00:00:00Z`);
    if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== s)
      throw new MoveError("日期不存在。");
    return new Date(utc.getTime() - 8 * 3600000);
  };
  const start = from ? date(from) : undefined,
    end = to ? new Date(date(to).getTime() + 86400000) : undefined;
  if (start && end && start >= end)
    throw new MoveError("開始日期不可晚於結束日期。");
  const where: Prisma.StockMoveWhereInput = {
    ...(type
      ? {
          type: type as
            | "IN"
            | "OUT"
            | "ADJUST_GAIN"
            | "ADJUST_LOSS"
            | "REVERSAL",
        }
      : {}),
    ...(status
      ? { status: status as "CONFIRMED" | "NEEDS_REVIEW" | "IGNORED" }
      : {}),
    ...(start || end
      ? {
          occurredAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lt: end } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { moveNo: { contains: q, mode: "insensitive" } },
            { operator: { contains: q, mode: "insensitive" } },
            { documentNo: { contains: q, mode: "insensitive" } },
            { item: { name: { contains: q, mode: "insensitive" } } },
            { location: { area: { contains: q, mode: "insensitive" } } },
            { location: { cabinetNo: { contains: q, mode: "insensitive" } } },
          ] as Prisma.StockMoveWhereInput[],
        }
      : {}),
  };
  return { q, type, status, from, to, where };
}
export function moveFilterQuery(filters: ReturnType<typeof moveFilters>) {
  return new URLSearchParams(
    Object.fromEntries(
      ["q", "type", "status", "from", "to"]
        .map((k) => [k, filters[k as "q"]])
        .filter(([, v]) => !!v),
    ),
  ).toString();
}
