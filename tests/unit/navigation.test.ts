import { describe, expect, it } from "vitest";
import { navigation, quickActions } from "../../src/lib/navigation";

describe("V2 navigation", () => {
  it("exposes all eleven V2 workspace destinations without signup", () => {
    expect(navigation.map(({ href }) => href)).toEqual([
      "/dashboard", "/inventory", "/inventory/new", "/moves/in", "/moves/out", "/stocktake",
      "/items", "/locations", "/moves", "/review", "/import-export", "/settings",
    ]);
  });
  it("provides the four required mobile workflows", () => {
    expect(quickActions.map(({ href }) => href)).toEqual(["/inventory", "/inventory/new", "/moves/in", "/moves/out", "/stocktake"]);
  });
});
