import "server-only";
import { inflateRawSync } from "node:zlib";
import { MoveError } from "@/lib/moves/validation";

/** Bound actual decompression before handing an untrusted OOXML file to SheetJS. */
export function validateXlsxZip(bytes: Buffer) {
  const fail = () => { throw new MoveError("檔案不是支援的 .xlsx，或壓縮內容超過安全限制。"); };
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) return fail();
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || bytes.readUInt32LE(end) !== 0x06054b50) return fail();
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  if (!count || count > 500 || start + size !== end || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || count !== bytes.readUInt16LE(end + 8)) return fail();
  let offset = start, total = 0;
  const names = new Set<string>();
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) return fail();
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), compressed = bytes.readUInt32LE(offset + 20), expanded = bytes.readUInt32LE(offset + 24);
    const len = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    if (offset + 46 + len + extra + comment > end || flags & 1 || ![0, 8].includes(method) || expanded > 16 * 1024 * 1024 || total + expanded > 32 * 1024 * 1024) return fail();
    const name = bytes.subarray(offset + 46, offset + 46 + len).toString("utf8");
    if (names.has(name) || /(?:vbaProject|externalLinks)/i.test(name) || name.includes("..") || local + 30 > start || bytes.readUInt32LE(local) !== 0x04034b50) return fail();
    names.add(name);
    const localLen = bytes.readUInt16LE(local + 26), data = local + 30 + localLen + bytes.readUInt16LE(local + 28);
    if (bytes.subarray(local + 30, local + 30 + localLen).toString("utf8") !== name || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method || data + compressed > start) return fail();
    try {
      const input = bytes.subarray(data, data + compressed);
      const output = method === 8 ? inflateRawSync(input, { maxOutputLength: Math.max(1, expanded) }) : input;
      if (output.length !== expanded) return fail();
      if (name === "[Content_Types].xml" && !output.toString("utf8").includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")) return fail();
    } catch { return fail(); }
    total += expanded; offset += 46 + len + extra + comment;
  }
  if (offset !== end || !names.has("xl/workbook.xml") || !names.has("[Content_Types].xml")) return fail();
}
