import { DB } from "../data/constants";
import { dbToTypes } from "../data/datatypes";
import { escapeQuotes } from "./exportSQL/shared";

const DEFAULT_ROWS_PER_TABLE = 3;

/**
 * Generate a single sample value for a field (for one row).
 * @param {object} field - table field { type, values, increment, default }
 * @param {string} database - DB.GENERIC, DB.MYSQL, etc.
 * @param {number} rowIndex - 0-based row index (used for increment and variety)
 * @returns {string|number|boolean} - value to insert (will be quoted in SQL if needed)
 */
function sampleValueForField(field, database, rowIndex) {
  const typeDef = dbToTypes[database]?.[field.type];
  if (field.default !== undefined && field.default !== "") {
    return field.default;
  }
  if (field.increment && typeDef?.canIncrement) {
    return rowIndex + 1;
  }
  switch (field.type) {
    case "INT":
    case "SMALLINT":
    case "BIGINT":
    case "TINYINT":
    case "MEDIUMINT":
    case "INTEGER":
    case "NUMBER":
      return rowIndex + 1;
    case "DECIMAL":
    case "NUMERIC":
    case "FLOAT":
    case "DOUBLE":
    case "REAL":
      return (rowIndex + 1) * 1.5;
    case "BOOLEAN":
      return rowIndex % 2 === 0;
    case "DATE":
      return `2024-01-${String(rowIndex + 1).padStart(2, "0")}`;
    case "TIME":
      return `12:00:${String(rowIndex).padStart(2, "0")}`;
    case "DATETIME":
    case "TIMESTAMP":
      return `2024-01-${String(rowIndex + 1).padStart(2, "0")} 12:00:00`;
    case "ENUM":
      const enumValues = field.values && field.values.length > 0 ? field.values : ["value1"];
      return enumValues[rowIndex % enumValues.length];
    case "SET":
      const setValues = field.values && field.values.length > 0 ? field.values : ["a"];
      return setValues.slice(0, (rowIndex % setValues.length) + 1).join(",");
    case "UUID":
      return `00000000-0000-0000-0000-${String(rowIndex + 1).padStart(12, "0")}`;
    case "JSON":
    case "JSONB":
      return JSON.stringify({ id: rowIndex + 1, name: `row_${rowIndex + 1}` });
    default:
      return `sample_${rowIndex + 1}`;
  }
}

/**
 * Format a value for use in an INSERT statement (quoted if needed).
 */
function formatValue(value, field, database) {
  if (value === null || value === undefined) return "NULL";
  const typeDef = dbToTypes[database]?.[field.type];
  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    if (database === DB.POSTGRES) return value ? "TRUE" : "FALSE";
    return value ? "1" : "0";
  }
  const str = String(value);
  if (typeDef?.hasQuotes === false) return str;
  return `'${escapeQuotes(str)}'`;
}

/**
 * Generate sample INSERT SQL for the given diagram.
 * @param {object} diagram - { tables, relationships, database }
 * @param {{ rowsPerTable?: number }} options
 * @returns {string} - SQL INSERT statements (MySQL-style)
 */
export function generateSampleData(diagram, options = {}) {
  const { tables = [], database = DB.GENERIC } = diagram;
  const rowsPerTable = options.rowsPerTable ?? DEFAULT_ROWS_PER_TABLE;
  const db = database in dbToTypes ? database : DB.GENERIC;
  const lines = [];

  for (const table of tables) {
    if (!table.fields || table.fields.length === 0) continue;
    const tableName = table.name.replace(/`/g, "``");
    const fieldsToInsert = table.fields.filter(
      (f) => !(f.primary && f.increment && dbToTypes[db]?.[f.type]?.canIncrement),
    );
    if (fieldsToInsert.length === 0) continue;

    const columns = fieldsToInsert.map(
      (f) => "`" + f.name.replace(/`/g, "``") + "`",
    );
    for (let r = 0; r < rowsPerTable; r++) {
      const values = fieldsToInsert.map((f) => {
        const val = sampleValueForField(f, db, r);
        return formatValue(val, f, db);
      });
      lines.push(
        `INSERT INTO \`${tableName}\` (${columns.join(", ")}) VALUES (${values.join(", ")});`,
      );
    }
  }

  return lines.join("\n");
}
