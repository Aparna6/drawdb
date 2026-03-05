import { DB } from "../../data/constants";

const DEFAULT_ROWS_PER_TABLE = 8;

const INTEGER_TYPES = new Set([
  "INT",
  "INTEGER",
  "TINYINT",
  "SMALLINT",
  "MEDIUMINT",
  "BIGINT",
  "SMALLSERIAL",
  "SERIAL",
  "BIGSERIAL",
  "LONG",
  "YEAR",
  "MYPRIMETYPE",
]);

const DECIMAL_TYPES = new Set([
  "DECIMAL",
  "NUMERIC",
  "NUMBER",
  "FLOAT",
  "DOUBLE",
  "REAL",
  "DOUBLE PRECISION",
  "MONEY",
  "SMALLMONEY",
]);

const BOOLEAN_TYPES = new Set(["BOOLEAN", "BOOL", "BIT"]);
const UUID_TYPES = new Set(["UUID", "UNIQUEIDENTIFIER"]);
const DATE_TYPES = new Set(["DATE"]);
const TIME_TYPES = new Set(["TIME", "TIMETZ"]);
const DATETIME_TYPES = new Set([
  "DATETIME",
  "DATETIME2",
  "DATETIMEOFFSET",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "SMALLDATETIME",
]);
const JSON_TYPES = new Set(["JSON", "JSONB", "SQL_VARIANT"]);
const XML_TYPES = new Set(["XML"]);
const BINARY_TYPES = new Set([
  "BINARY",
  "VARBINARY",
  "BLOB",
  "TINYBLOB",
  "MEDIUMBLOB",
  "LONGBLOB",
  "BYTEA",
  "RAW",
  "IMAGE",
]);

function normalizeType(type) {
  return String(type || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function quoteIdentifier(name, database) {
  const value = String(name || "");
  switch (database) {
    case DB.MYSQL:
    case DB.MARIADB:
      return `\`${value.replace(/`/g, "``")}\``;
    case DB.MSSQL:
      return `[${value.replace(/]/g, "]]")}]`;
    default:
      return `"${value.replace(/"/g, '""')}"`;
  }
}

function getBooleanLiteral(value, database) {
  if (database === DB.POSTGRES || database === DB.ORACLESQL) {
    return value ? "TRUE" : "FALSE";
  }
  return value ? "1" : "0";
}

function formatDate(rowIndex) {
  const day = String((rowIndex % 28) + 1).padStart(2, "0");
  return `2024-01-${day}`;
}

function formatTime(rowIndex) {
  const h = String(rowIndex % 24).padStart(2, "0");
  const m = String((rowIndex * 7) % 60).padStart(2, "0");
  const s = String((rowIndex * 13) % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function safeToken(value) {
  return String(value || "value")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function generateUUID(rowIndex) {
  return `00000000-0000-4000-8000-${String(rowIndex + 1).padStart(12, "0")}`;
}

function sampleValue(field, rowIndex, tableName) {
  const type = normalizeType(field.type);

  if ((type === "ENUM" || type === "SET") && Array.isArray(field.values)) {
    if (field.values.length === 0) return `${safeToken(field.name)}_${rowIndex + 1}`;
    if (type === "SET" && field.values.length > 1) {
      return rowIndex % 2 === 0
        ? `${field.values[0]},${field.values[1]}`
        : field.values[rowIndex % field.values.length];
    }
    return field.values[rowIndex % field.values.length];
  }

  if (UUID_TYPES.has(type)) return generateUUID(rowIndex);
  if (DATE_TYPES.has(type)) return formatDate(rowIndex);
  if (TIME_TYPES.has(type)) return formatTime(rowIndex);
  if (DATETIME_TYPES.has(type))
    return `${formatDate(rowIndex)} ${formatTime(rowIndex)}`;
  if (BOOLEAN_TYPES.has(type)) return rowIndex % 2 === 0;
  if (INTEGER_TYPES.has(type)) return rowIndex + 1;
  if (DECIMAL_TYPES.has(type)) return Number(((rowIndex + 1) * 1.11).toFixed(2));
  if (JSON_TYPES.has(type)) {
    return {
      id: rowIndex + 1,
      label: `${safeToken(tableName)}_${safeToken(field.name)}_${rowIndex + 1}`,
    };
  }
  if (XML_TYPES.has(type)) {
    const tag = safeToken(field.name) || "node";
    return `<${tag} id="${rowIndex + 1}" />`;
  }
  if (BINARY_TYPES.has(type)) {
    return `binary_${safeToken(field.name)}_${String(rowIndex + 1).padStart(2, "0")}`;
  }

  return `${safeToken(tableName)}_${safeToken(field.name)}_${rowIndex + 1}`;
}

function valueToSqlLiteral(value, field, database) {
  const type = normalizeType(field.type);

  if (value === null || value === undefined) return "NULL";

  if (typeof value === "boolean") return getBooleanLiteral(value, database);

  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "0";

  if (type === "BIT" && /^\d+$/.test(String(value))) {
    return `${value}`;
  }

  if (typeof value === "object") {
    return `'${escapeSqlString(JSON.stringify(value))}'`;
  }

  return `'${escapeSqlString(value)}'`;
}

function topologicalTableOrder(tables, relationships) {
  const ids = tables.map((table) => table.id);
  const byId = new Map(tables.map((table) => [table.id, table]));
  const idSet = new Set(ids);

  const adjacency = new Map(ids.map((id) => [id, new Set()]));
  const inDegree = new Map(ids.map((id) => [id, 0]));

  relationships.forEach((rel) => {
    if (
      !idSet.has(rel.startTableId) ||
      !idSet.has(rel.endTableId) ||
      rel.startTableId === rel.endTableId
    ) {
      return;
    }
    const parent = rel.endTableId;
    const child = rel.startTableId;
    if (!adjacency.get(parent).has(child)) {
      adjacency.get(parent).add(child);
      inDegree.set(child, inDegree.get(child) + 1);
    }
  });

  const queue = ids
    .filter((id) => inDegree.get(id) === 0)
    .sort((a, b) => byId.get(a).name.localeCompare(byId.get(b).name));

  const order = [];
  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);
    adjacency.get(current).forEach((neighbor) => {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
        queue.sort((a, b) => byId.get(a).name.localeCompare(byId.get(b).name));
      }
    });
  }

  if (order.length < ids.length) {
    ids.forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
  }

  return order;
}

export function generateSampleDataSQL({
  tables,
  relationships,
  database,
  rowsPerTable = DEFAULT_ROWS_PER_TABLE,
}) {
  if (!tables || tables.length === 0) {
    return "-- No tables available to generate sample data.";
  }

  const tableById = new Map(tables.map((table) => [table.id, table]));
  const validRelationships = (relationships || []).filter(
    (rel) => tableById.has(rel.startTableId) && tableById.has(rel.endTableId),
  );

  const fkByField = new Map();
  validRelationships.forEach((rel) => {
    fkByField.set(`${rel.startTableId}:${rel.startFieldId}`, rel);
  });

  const generatedValuesByTable = new Map();
  const orderedTableIds = topologicalTableOrder(tables, validRelationships);
  const chunks = [
    `-- Sample data generated by drawDB`,
    `-- Rows per table: ${rowsPerTable}`,
    "",
  ];

  orderedTableIds.forEach((tableId) => {
    const table = tableById.get(tableId);
    const fields = table.fields || [];
    const insertFields = fields.filter((field) => field.name && !field.increment);
    const rowValues = [];

    for (let rowIndex = 0; rowIndex < rowsPerTable; rowIndex++) {
      const rawByFieldId = {};
      fields.forEach((field) => {
        const fk = fkByField.get(`${table.id}:${field.id}`);
        let value;
        if (fk) {
          const parentRows = generatedValuesByTable.get(fk.endTableId) || [];
          const parentRow =
            parentRows.length > 0 ? parentRows[rowIndex % parentRows.length] : null;
          value =
            parentRow && parentRow[fk.endFieldId] !== undefined
              ? parentRow[fk.endFieldId]
              : rowIndex + 1;
        } else {
          value = sampleValue(field, rowIndex, table.name);
        }
        rawByFieldId[field.id] = value;
      });
      rowValues.push(rawByFieldId);
    }

    generatedValuesByTable.set(table.id, rowValues);

    chunks.push(`-- ${table.name}`);
    if (insertFields.length === 0) {
      for (let rowIndex = 0; rowIndex < rowsPerTable; rowIndex++) {
        if (
          database === DB.MYSQL ||
          database === DB.MARIADB ||
          database === DB.SQLITE
        ) {
          chunks.push(`INSERT INTO ${quoteIdentifier(table.name, database)} () VALUES ();`);
        } else {
          chunks.push(`INSERT INTO ${quoteIdentifier(table.name, database)} DEFAULT VALUES;`);
        }
      }
      chunks.push("");
      return;
    }

    rowValues.forEach((values) => {
      const columns = insertFields.map((field) => quoteIdentifier(field.name, database));
      const literals = insertFields.map((field) =>
        valueToSqlLiteral(values[field.id], field, database),
      );
      chunks.push(
        `INSERT INTO ${quoteIdentifier(table.name, database)} (${columns.join(", ")}) VALUES (${literals.join(", ")});`,
      );
    });
    chunks.push("");
  });

  return chunks.join("\n");
}
