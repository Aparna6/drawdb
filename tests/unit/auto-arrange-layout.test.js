import { describe, expect, test } from "vitest";
import { autoArrangeTables } from "../../src/utils/arrangeTables";

function makeTable(id, x = 0, y = 0, fields = 2) {
  return {
    id,
    name: id,
    x,
    y,
    fields: Array.from({ length: fields }, (_, i) => ({
      id: `${id}_f${i}`,
      name: `f${i}`,
      type: "INT",
    })),
  };
}

describe("autoArrangeTables", () => {
  test("repositions overlapping tables in hybrid mode", () => {
    const tables = [makeTable("a"), makeTable("b"), makeTable("c")];
    const relationships = [
      { startTableId: "a", endTableId: "b" },
      { startTableId: "b", endTableId: "c" },
    ];

    const arranged = autoArrangeTables(tables, relationships, {
      algorithm: "hybrid",
      tableWidth: 200,
    });

    const movedCount = arranged.filter(
      (table, index) =>
        table.x !== tables[index].x || table.y !== tables[index].y,
    ).length;

    expect(movedCount).toBeGreaterThan(0);

    const uniquePositions = new Set(arranged.map((table) => `${table.x},${table.y}`));
    expect(uniquePositions.size).toBeGreaterThan(1);
  });

  test("does not mutate the original table objects", () => {
    const original = [makeTable("a"), makeTable("b")];
    const snapshot = JSON.parse(JSON.stringify(original));

    autoArrangeTables(original, [], { algorithm: "layered", tableWidth: 220 });

    expect(original).toEqual(snapshot);
  });

  test("returns unchanged coordinates for an unknown algorithm", () => {
    const tables = [makeTable("a", 12, 34), makeTable("b", 56, 78)];

    const arranged = autoArrangeTables(tables, [], {
      algorithm: "unknown",
      tableWidth: 200,
    });

    expect(arranged).toEqual(tables);
    expect(arranged).not.toBe(tables);
  });
});
