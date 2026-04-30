import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className helper)", () => {
  it("merges plain classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("dedupes conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("supports conditional object syntax", () => {
    expect(cn({ active: true, disabled: false })).toBe("active");
  });
});
