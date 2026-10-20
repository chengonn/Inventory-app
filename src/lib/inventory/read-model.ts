export type SearchParams = Record<string, string | string[] | undefined>;
export function searchOptions(params: SearchParams) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page =
    typeof params.page === "string" && /^[1-9]\d{0,5}$/.test(params.page)
      ? Number(params.page)
      : 1;
  return { q, page, low: params.low === "1" };
}
export function taipeiDay(now: Date) {
  const shifted = new Date(now.getTime() + 8 * 3600000);
  const start = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) -
      8 * 3600000,
  );
  return { start, end: new Date(start.getTime() + 86400000) };
}
const thousandths = (s: string) => BigInt(s.replace(".", ""));
type Item = {
  id: number;
  name: string;
  unit: string | null;
  isActive: boolean;
  safetyStock: string | null;
};
type Location = {
  id: number;
  area: string;
  cabinetNo: string;
  isActive: boolean;
};
type Stock = {
  itemId: number;
  locationId: number;
  currentQty: string;
  openingQty: string;
  movementQty: string;
  itemTotalQty: string;
};
export function inventoryRows(
  items: Item[],
  locations: Location[],
  stock: Stock[],
  review: { itemId: number; locationId: number }[],
) {
  const locs = new Map(locations.map((l) => [l.id, l]));
  return items
    .map((item) => {
      const confirmed = stock.filter((s) => s.itemId === item.id),
        pending = review.filter((r) => r.itemId === item.id);
      const current = confirmed[0]?.itemTotalQty ?? "0.000";
      const ids = [
        ...new Set([
          ...confirmed.map((s) => s.locationId),
          ...pending.map((r) => r.locationId),
        ]),
      ];
      const pairs = ids
        .flatMap((id) => {
          const l = locs.get(id);
          if (!l) return [];
          const s = confirmed.find((r) => r.locationId === id);
          return [
            {
              ...l,
              current: s?.currentQty ?? "0.000",
              opening: s?.openingQty ?? "0.000",
              movement: s?.movementQty ?? "0.000",
              hasConfirmed: !!s,
              review: pending.filter((r) => r.locationId === id).length,
            },
          ];
        })
        .sort(
          (a, b) =>
            a.area.localeCompare(b.area, "zh-TW") ||
            a.cabinetNo.localeCompare(b.cabinetNo, "zh-TW") ||
            a.id - b.id,
        );
      return {
        ...item,
        current,
        hasStock: thousandths(current) > BigInt(0),
        low:
          item.safetyStock !== null &&
          thousandths(current) < thousandths(item.safetyStock),
        hasConfirmed: confirmed.length > 0,
        review: pending.length,
        pairs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-TW") || a.id - b.id);
}
export type InventoryRow = ReturnType<typeof inventoryRows>[number];
export function filterInventory(
  rows: InventoryRow[],
  options: ReturnType<typeof searchOptions>,
) {
  const needle = options.q.toLocaleLowerCase("zh-TW");
  const filtered = rows.flatMap((row) => {
    if (options.low && !row.low) return [];
    if (!needle || row.name.toLocaleLowerCase("zh-TW").includes(needle))
      return [row];
    const pairs = row.pairs.filter((l) =>
      [l.area, l.cabinetNo].some((v) =>
        v.toLocaleLowerCase("zh-TW").includes(needle),
      ),
    );
    return pairs.length ? [{ ...row, pairs }] : [];
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    page = Math.min(options.page, pages);
  return {
    rows: filtered.slice((page - 1) * 20, page * 20),
    total: filtered.length,
    pages,
    page,
  };
}
