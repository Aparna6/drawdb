import { useMemo } from "react";
import {
  tableColorStripHeight,
  tableFieldHeight,
  tableHeaderHeight,
} from "../data/constants";
import { useDiagram, useSettings } from "../hooks";
import { useTranslation } from "react-i18next";

const EPSILON = 1e-9;
const MAX_CROSSING_SCAN_EDGES = 320;

function tableHeight(table) {
  return (
    table.fields.length * tableFieldHeight +
    tableHeaderHeight +
    tableColorStripHeight
  );
}

function orientation(a, b, c) {
  const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(val) < EPSILON) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

function segmentsIntersect(p1, p2, q1, q2) {
  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, q1, p2)) return true;
  if (o2 === 0 && onSegment(p1, q2, p2)) return true;
  if (o3 === 0 && onSegment(q1, p1, q2)) return true;
  if (o4 === 0 && onSegment(q1, p2, q2)) return true;
  return false;
}

function stronglyConnectedComponents(ids, adjacency) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowlink = new Map();
  const sccs = [];

  const strongConnect = (id) => {
    indices.set(id, index);
    lowlink.set(id, index);
    index++;
    stack.push(id);
    onStack.add(id);

    adjacency.get(id).forEach((neighbor) => {
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        lowlink.set(id, Math.min(lowlink.get(id), lowlink.get(neighbor)));
      } else if (onStack.has(neighbor)) {
        lowlink.set(id, Math.min(lowlink.get(id), indices.get(neighbor)));
      }
    });

    if (lowlink.get(id) === indices.get(id)) {
      const component = [];
      while (stack.length > 0) {
        const node = stack.pop();
        onStack.delete(node);
        component.push(node);
        if (node === id) break;
      }
      sccs.push(component);
    }
  };

  ids.forEach((id) => {
    if (!indices.has(id)) strongConnect(id);
  });

  return sccs;
}

function maxDepth(ids, relationships) {
  if (ids.length === 0) return 0;

  const adjacency = new Map(ids.map((id) => [id, new Set()]));
  relationships.forEach((rel) => {
    if (rel.startTableId !== rel.endTableId) {
      adjacency.get(rel.startTableId)?.add(rel.endTableId);
    }
  });

  const sccs = stronglyConnectedComponents(ids, adjacency);
  const componentByNode = new Map();
  sccs.forEach((component, i) => {
    component.forEach((node) => componentByNode.set(node, i));
  });

  const dag = new Map(sccs.map((_, i) => [i, new Set()]));
  relationships.forEach((rel) => {
    const from = componentByNode.get(rel.startTableId);
    const to = componentByNode.get(rel.endTableId);
    if (from !== undefined && to !== undefined && from !== to) {
      dag.get(from).add(to);
    }
  });

  const memo = new Map();
  const depth = (componentId) => {
    if (memo.has(componentId)) return memo.get(componentId);
    let best = 1;
    dag.get(componentId).forEach((next) => {
      best = Math.max(best, 1 + depth(next));
    });
    memo.set(componentId, best);
    return best;
  };

  let best = 1;
  dag.forEach((_, id) => {
    best = Math.max(best, depth(id));
  });
  return best;
}

function getLayoutStats(tables, relationships, tableWidth) {
  const ids = tables.map((table) => table.id);
  const idSet = new Set(ids);
  const validRelationships = relationships.filter(
    (rel) => idSet.has(rel.startTableId) && idSet.has(rel.endTableId),
  );

  const undirected = new Map(ids.map((id) => [id, new Set()]));
  validRelationships.forEach((rel) => {
    if (rel.startTableId !== rel.endTableId) {
      undirected.get(rel.startTableId).add(rel.endTableId);
      undirected.get(rel.endTableId).add(rel.startTableId);
    }
  });

  const visited = new Set();
  let components = 0;
  ids.forEach((id) => {
    if (visited.has(id)) return;
    components++;
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift();
      undirected.get(current).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  });

  const isolatedTables = ids.filter((id) => undirected.get(id).size === 0).length;
  const heights = new Map(tables.map((table) => [table.id, tableHeight(table)]));
  const tablesById = new Map(tables.map((table) => [table.id, table]));

  const segments = validRelationships
    .filter((rel) => rel.startTableId !== rel.endTableId)
    .map((rel) => {
      const start = tablesById.get(rel.startTableId);
      const end = tablesById.get(rel.endTableId);
      return {
        startId: rel.startTableId,
        endId: rel.endTableId,
        p1: {
          x: start.x + tableWidth / 2,
          y: start.y + heights.get(start.id) / 2,
        },
        p2: {
          x: end.x + tableWidth / 2,
          y: end.y + heights.get(end.id) / 2,
        },
      };
    });

  let crossings = 0;
  if (segments.length <= MAX_CROSSING_SCAN_EDGES) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i];
        const b = segments[j];
        if (
          a.startId === b.startId ||
          a.startId === b.endId ||
          a.endId === b.startId ||
          a.endId === b.endId
        ) {
          continue;
        }
        if (segmentsIntersect(a.p1, a.p2, b.p1, b.p2)) {
          crossings++;
        }
      }
    }
  } else {
    crossings = "N/A";
  }

  return {
    tableCount: tables.length,
    relationshipCount: validRelationships.length,
    maxDepth: maxDepth(ids, validRelationships),
    components,
    isolatedTables,
    crossings,
  };
}

function Stat({ label, value }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-xs opacity-75">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function StatsBox() {
  const { tables, relationships } = useDiagram();
  const { settings } = useSettings();
  const { t } = useTranslation();

  const stats = useMemo(
    () => getLayoutStats(tables, relationships, settings.tableWidth),
    [tables, relationships, settings.tableWidth],
  );

  return (
    <div className="popover-theme rounded-lg border border-color p-3 min-w-[220px] shadow-lg">
      <div className="text-sm font-semibold mb-2">{t("stats_box")}</div>
      <div className="space-y-1.5 text-sm">
        <Stat label={t("stats_tables")} value={stats.tableCount} />
        <Stat label={t("stats_relationships")} value={stats.relationshipCount} />
        <Stat label={t("stats_max_depth")} value={stats.maxDepth} />
        <Stat label={t("stats_components")} value={stats.components} />
        <Stat label={t("stats_isolated_tables")} value={stats.isolatedTables} />
        <Stat label={t("stats_line_crossings")} value={stats.crossings} />
      </div>
    </div>
  );
}
