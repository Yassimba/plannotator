import { describe, expect, test } from "bun:test";
import { parseCodeTargets, primaryCodeTarget } from "./diagram-svg";

describe("parseCodeTargets", () => {
  test("names files in author order, trims a revision suffix, skips blanks", () => {
    expect(parseCodeTargets("a.ts:10-20, b.ts@HEAD~1, , :::")).toEqual([{ path: "a.ts", line: 10 }, { path: "b.ts" }]);
    expect(parseCodeTargets(null)).toEqual([]);
  });
});

describe("primaryCodeTarget", () => {
  test("keeps the first line of a range so a click can scroll to it", () => {
    expect(primaryCodeTarget("a.ts:40-66, b.ts")).toEqual({ path: "a.ts", line: 40 });
    expect(primaryCodeTarget("a.ts:7")).toEqual({ path: "a.ts", line: 7 });
  });

  test("omits the line when the suffix is a revision or absent", () => {
    expect(primaryCodeTarget("a.ts@HEAD~1")).toEqual({ path: "a.ts" });
    expect(primaryCodeTarget("")).toBeNull();
  });
});
