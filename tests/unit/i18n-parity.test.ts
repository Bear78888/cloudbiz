import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";

/**
 * Runtime missing-key check (§9.4) complementing the compile-time `Dict`
 * type: recursively compares the key structure of both dictionaries and
 * verifies no leaf is left empty.
 */

type Tree = Record<string, unknown>;

function collectPaths(tree: Tree, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      paths.push(`${path}[${value.length}]`);
    } else if (value !== null && typeof value === "object") {
      paths.push(...collectPaths(value as Tree, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

function collectEmptyLeaves(tree: Tree, prefix = ""): string[] {
  const empty: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string" && item.trim() === "") empty.push(`${path}[${index}]`);
      });
    } else if (value !== null && typeof value === "object") {
      empty.push(...collectEmptyLeaves(value as Tree, path));
    } else if (typeof value === "string" && value.trim() === "") {
      empty.push(path);
    }
  }
  return empty;
}

describe("i18n dictionaries", () => {
  it("en and es expose the identical key structure (§9.4)", () => {
    expect(collectPaths(es as Tree)).toEqual(collectPaths(en as Tree));
  });

  it("no dictionary leaf is empty", () => {
    expect(collectEmptyLeaves(en as Tree)).toEqual([]);
    expect(collectEmptyLeaves(es as Tree)).toEqual([]);
  });
});
