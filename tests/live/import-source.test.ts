import { afterAll, expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { getPrisma } from "../../src/lib/prisma";
import { parseWorkbook } from "../../src/lib/imports/parse";
import { inspectImport } from "../../src/lib/imports/transaction";
import { counts } from "../../src/lib/imports/model";
// Opt-in, READ ONLY against actual development data. No preview token or import is created.
const db = getPrisma();
afterAll(async () => { await db.$disconnect(); });
it.skipIf(!process.env.IMPORT_SOURCE_FILE)("previews private source against actual dev DB without mutations", async () => {
  const source = process.env.IMPORT_SOURCE_FILE!;
  const plan = parseWorkbook(await readFile(source), basename(source));
  const result = await db.$transaction(async (tx) => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return inspectImport(tx, plan); }, { isolationLevel: "RepeatableRead", timeout: 15000 });
  const report = { fileName: plan.fileName, fileHash: plan.fileHash, generatedAt: new Date().toISOString(), committed: false, counts: counts(plan), issues: result.issues,
    rows: [...plan.openings, ...plan.moves, ...plan.archives], effects: result.effects };
  // Outside the app Git repository; actual workbook data must never be committed.
  await writeFile("../../work/step-10-private-preview.json", JSON.stringify(report, null, 2));
  expect(result.issues.filter((r) => r.level === "error")).toEqual([]);
});
