import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { parseLocale, translator } from "../../src/lib/i18n/core";
import { english } from "../../src/lib/i18n/english";
it("accepts only supported locales, preserving Chinese by default", () => {
  expect(parseLocale("en")).toBe("en");
  for (const value of [undefined, "fr", "../en", "<script>", "zh-Hant"])
    expect(parseLocale(value)).toBe("zh-Hant");
  expect(translator("zh-Hant")("登入")).toBe("登入");
  expect(translator("en")("登入")).toBe("Sign in");
  expect(translator("en")("name 未填或超過長度限制。")).toContain("required");
  expect(translator("en")("Customer item 123")).toBe("Customer item 123");
});
it("has translations for every literal presentation message", () => {
  const missing = new Set<string>();
  for (const root of ["src/app", "src/components"])
    for (const file of readdirSync(root, { recursive: true }).filter((f) =>
      String(f).endsWith(".tsx"),
    )) {
      const path = join(root, String(file));
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text.replace(/\s+/g, " ").trim();
          if (/[\u3400-\u9fff]/.test(key) && english[key] === undefined)
            missing.add(key);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  expect([...missing]).toEqual([]);
});
