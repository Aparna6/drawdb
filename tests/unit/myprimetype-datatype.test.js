import { describe, expect, test } from "vitest";
import { DB } from "../../src/data/constants";
import { dbToTypes } from "../../src/data/datatypes";
import { getJsonType, getTypeString } from "../../src/utils/exportSQL/generic";
import { toMySQL } from "../../src/utils/exportSQL/mysql";
import { toMariaDB } from "../../src/utils/exportSQL/mariadb";
import { toPostgres } from "../../src/utils/exportSQL/postgres";
import { toSqlite } from "../../src/utils/exportSQL/sqlite";
import { toMSSQL } from "../../src/utils/exportSQL/mssql";
import { toOracleSQL } from "../../src/utils/exportSQL/oraclesql";

describe("MYPRIMETYPE datatype", () => {
  test("accepts odd positive integer defaults and rejects others", () => {
    const databases = [
      DB.GENERIC,
      DB.MYSQL,
      DB.POSTGRES,
      DB.SQLITE,
      DB.MSSQL,
      DB.MARIADB,
      DB.ORACLESQL,
    ];

    databases.forEach((database) => {
      expect(
        dbToTypes[database].MYPRIMETYPE.checkDefault({ default: "11" }),
      ).toBe(true);
      expect(
        dbToTypes[database].MYPRIMETYPE.checkDefault({ default: "2" }),
      ).toBe(false);
      expect(
        dbToTypes[database].MYPRIMETYPE.checkDefault({ default: "0" }),
      ).toBe(false);
    });
  });

  test("maps to numeric/json-schema number types in generic export helpers", () => {
    expect(getJsonType({ type: "MYPRIMETYPE" })).toContain('"number"');

    const field = { name: "prime_like", type: "MYPRIMETYPE", size: "" };
    expect(getTypeString(field, DB.GENERIC, DB.MYSQL)).toBe("INT");
    expect(getTypeString(field, DB.GENERIC, DB.POSTGRES)).toBe("integer");
    expect(getTypeString(field, DB.GENERIC, DB.MSSQL)).toBe("INT");
    expect(getTypeString(field, DB.GENERIC, DB.ORACLESQL)).toBe("NUMBER(38,0)");
  });

  test("exports database-specific SQL type mappings", () => {
    const diagram = {
      database: DB.GENERIC,
      enums: [],
      types: [],
      references: [],
      relationships: [],
      tables: [
        {
          id: "t1",
          name: "items",
          fields: [
            {
              id: "f1",
              name: "prime_like",
              type: "MYPRIMETYPE",
              default: "",
              check: "",
              notNull: false,
              unique: false,
              increment: false,
              unsigned: false,
              comment: "",
            },
          ],
          indices: [],
          comment: "",
        },
      ],
    };

    expect(toMySQL(diagram)).toContain("`prime_like` INT");
    expect(toMariaDB(diagram)).toContain("`prime_like` INT");
    expect(toPostgres(diagram)).toContain('"prime_like" INTEGER');
    expect(toSqlite(diagram)).toContain('"prime_like" INTEGER');
    expect(toMSSQL(diagram)).toContain("[prime_like] INT");
    expect(toOracleSQL(diagram)).toContain('"prime_like" NUMBER');
  });
});
