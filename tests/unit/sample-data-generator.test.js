import { describe, expect, test } from "vitest";
import { DB } from "../../src/data/constants";
import { generateSampleDataSQL } from "../../src/utils/exportAs/sampleData";

describe("generateSampleDataSQL", () => {
  test("returns a helpful message when no tables are present", () => {
    const result = generateSampleDataSQL({
      tables: [],
      relationships: [],
      database: DB.POSTGRES,
    });

    expect(result).toContain("No tables available");
  });

  test("generates FK-consistent rows in topological order", () => {
    const users = {
      id: "t_users",
      name: "users",
      fields: [
        { id: "f_uid", name: "id", type: "INT", increment: false },
        { id: "f_uname", name: "name", type: "VARCHAR", increment: false },
      ],
    };

    const orders = {
      id: "t_orders",
      name: "orders",
      fields: [
        { id: "f_oid", name: "id", type: "INT", increment: false },
        { id: "f_user_id", name: "user_id", type: "INT", increment: false },
      ],
    };

    const sql = generateSampleDataSQL({
      tables: [orders, users],
      relationships: [
        {
          startTableId: "t_orders",
          startFieldId: "f_user_id",
          endTableId: "t_users",
          endFieldId: "f_uid",
        },
      ],
      database: DB.POSTGRES,
      rowsPerTable: 2,
    });

    expect(sql.indexOf("-- users")).toBeLessThan(sql.indexOf("-- orders"));
    expect(sql).toContain(
      'INSERT INTO "orders" ("id", "user_id") VALUES (1, 1);',
    );
    expect(sql).toContain(
      'INSERT INTO "orders" ("id", "user_id") VALUES (2, 2);',
    );
  });

  test("uses empty-column insert fallback for auto-increment-only tables", () => {
    const sql = generateSampleDataSQL({
      tables: [
        {
          id: "t_audit",
          name: "audit_log",
          fields: [{ id: "f_id", name: "id", type: "INT", increment: true }],
        },
      ],
      relationships: [],
      database: DB.MYSQL,
      rowsPerTable: 2,
    });

    expect(sql).toContain("INSERT INTO `audit_log` () VALUES ();");
  });
});
