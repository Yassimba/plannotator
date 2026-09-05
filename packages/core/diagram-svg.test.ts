import { describe, expect, test } from "bun:test";
import { primaryCodeTarget } from "./diagram-svg";

describe("primaryCodeTarget", () => {
  test("keeps the first entry's line range so a click can scroll to it", () => {
    expect(primaryCodeTarget("a/b.ts:40-66, c.ts")).toEqual({ filePath: "a/b.ts", line: 40, lineEnd: 66 });
    expect(primaryCodeTarget("a/b.ts:7")).toEqual({ filePath: "a/b.ts", line: 7, lineEnd: undefined });
  });

  test("trims a revision suffix and names nothing for an empty value", () => {
    expect(primaryCodeTarget("a/b.ts@HEAD~1")).toEqual({ filePath: "a/b.ts" });
    expect(primaryCodeTarget("")).toBeNull();
    expect(primaryCodeTarget(null)).toBeNull();
  });
});
