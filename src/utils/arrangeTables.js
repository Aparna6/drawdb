import {
  tableColorStripHeight,
  tableFieldHeight,
  tableHeaderHeight,
  tableWidth as defaultTableWidth,
} from "../data/constants";

const DEFAULT_PADDING = 64;
const DEFAULT_GAP_X = 120;
const DEFAULT_GAP_Y = 56;
const DEFAULT_COMPONENT_GAP = 180;

function tableHeight(table) {
  return (
    table.fields.length * tableFieldHeight +
    tableHeaderHeight +
    tableColorStripHeight
  );
}

function edgeKey(a, b) {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? `${sa}|${sb}` : `${sb}|${sa}`;
}

function buildGraph(tables, relationships) {
  const ids = tables.map((t) => t.id);
  const idSet = new Set(ids);
  const adjacency = new Map(ids.map((id) => [id, new Set()]));
  const dedupEdges = new Map();

  relationships.forEach((rel) => {
    const a = rel.startTableId;
    const b = rel.endTableId;
    if (!idSet.has(a) || !idSet.has(b) || a === b) return;

    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
    const key = edgeKey(a, b);
    if (!dedupEdges.has(key)) dedupEdges.set(key, [a, b]);
  });

  const edges = [...dedupEdges.values()];
  return { ids, adjacency, edges };
}

function connectedComponents(ids, adjacency) {
  const visited = new Set();
  const components = [];

  ids.forEach((id) => {
    if (visited.has(id)) return;
    const queue = [id];
    visited.add(id);
    const component = [];

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);

      adjacency.get(current).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    components.push(component);
  });

  return components;
}

function layeredPositions(tables, relationships, tableWidth, tableHeights) {
  const positions = new Map();
  const indexById = new Map(tables.map((t, i) => [t.id, i]));
  const { ids, adjacency } = buildGraph(tables, relationships);
  const components = connectedComponents(ids, adjacency).sort(
    (a, b) => b.length - a.length,
  );

  let baseX = DEFAULT_PADDING;

  components.forEach((component) => {
    const depth = new Map();
    const root = component
      .slice()
      .sort((a, b) => {
        const degreeDiff = adjacency.get(b).size - adjacency.get(a).size;
        if (degreeDiff !== 0) return degreeDiff;
        return indexById.get(a) - indexById.get(b);
      })[0];

    const queue = [root];
    depth.set(root, 0);

    while (queue.length > 0) {
      const current = queue.shift();
      const currentDepth = depth.get(current);

      adjacency.get(current).forEach((neighbor) => {
        if (!depth.has(neighbor)) {
          depth.set(neighbor, currentDepth + 1);
          queue.push(neighbor);
        }
      });
    }

    component.forEach((id) => {
      if (!depth.has(id)) depth.set(id, 0);
    });

    const layers = new Map();
    component.forEach((id) => {
      const d = depth.get(id);
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d).push(id);
    });

    const layerNumbers = [...layers.keys()].sort((a, b) => a - b);
    const order = new Map();
    layerNumbers.forEach((layer) => {
      layers
        .get(layer)
        .sort((a, b) => indexById.get(a) - indexById.get(b))
        .forEach((id, i) => order.set(id, i));
    });

    const sweep = (downward = true) => {
      const targetLayers = downward
        ? layerNumbers.slice(1)
        : layerNumbers.slice(0, -1).reverse();

      targetLayers.forEach((layer) => {
        layers.get(layer).sort((a, b) => {
          const neighborsA = [...adjacency.get(a)].filter((id) =>
            downward ? depth.get(id) < layer : depth.get(id) > layer,
          );
          const neighborsB = [...adjacency.get(b)].filter((id) =>
            downward ? depth.get(id) < layer : depth.get(id) > layer,
          );

          const baryA =
            neighborsA.length === 0
              ? order.get(a)
              : neighborsA.reduce((sum, id) => sum + order.get(id), 0) /
                neighborsA.length;
          const baryB =
            neighborsB.length === 0
              ? order.get(b)
              : neighborsB.reduce((sum, id) => sum + order.get(id), 0) /
                neighborsB.length;

          if (baryA !== baryB) return baryA - baryB;
          return order.get(a) - order.get(b);
        });

        layers.get(layer).forEach((id, i) => order.set(id, i));
      });
    };

    for (let i = 0; i < 6; i++) {
      sweep(true);
      sweep(false);
    }

    const maxLayer = layerNumbers[layerNumbers.length - 1] || 0;
    let componentHeight = 0;
    const layerHeights = new Map();

    layerNumbers.forEach((layer) => {
      let h = 0;
      layers.get(layer).forEach((id, i) => {
        h += tableHeights.get(id);
        if (i < layers.get(layer).length - 1) h += DEFAULT_GAP_Y;
      });
      layerHeights.set(layer, h);
      componentHeight = Math.max(componentHeight, h);
    });

    layerNumbers.forEach((layer) => {
      const x = baseX + layer * (tableWidth + DEFAULT_GAP_X);
      let y =
        DEFAULT_PADDING + Math.max(0, (componentHeight - layerHeights.get(layer)) / 2);

      layers.get(layer).forEach((id) => {
        positions.set(id, { x, y });
        y += tableHeights.get(id) + DEFAULT_GAP_Y;
      });
    });

    baseX +=
      (maxLayer + 1) * tableWidth +
      maxLayer * DEFAULT_GAP_X +
      DEFAULT_COMPONENT_GAP;
  });

  return positions;
}

function forceDirectedPositions(tables, relationships, tableWidth, tableHeights) {
  const positions = new Map();
  const { ids, edges } = buildGraph(tables, relationships);
  const n = ids.length;

  if (n === 0) return positions;

  const radius = Math.max(tableWidth * 1.5, Math.sqrt(n) * (tableWidth * 0.9));
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n;
    positions.set(id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  const area = Math.max(1, n) * Math.pow(tableWidth + DEFAULT_GAP_X, 2);
  const k = Math.sqrt(area / Math.max(1, n));
  const iterations = Math.min(340, 180 + n * 8);
  let temperature = tableWidth + DEFAULT_GAP_X;

  for (let iter = 0; iter < iterations; iter++) {
    const displacement = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ids[i];
        const b = ids[j];
        const pa = positions.get(a);
        const pb = positions.get(b);
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.001) {
          dx = 0.01;
          dy = 0.01;
          dist = 0.014;
        }

        const force = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;

        displacement.get(a).x += ux * force;
        displacement.get(a).y += uy * force;
        displacement.get(b).x -= ux * force;
        displacement.get(b).y -= uy * force;
      }
    }

    edges.forEach(([a, b]) => {
      const pa = positions.get(a);
      const pb = positions.get(b);
      let dx = pa.x - pb.x;
      let dy = pa.y - pb.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 0.001) {
        dx = 0.01;
        dy = 0.01;
        dist = 0.014;
      }

      const force = (dist * dist) / k;
      const ux = dx / dist;
      const uy = dy / dist;

      displacement.get(a).x -= ux * force;
      displacement.get(a).y -= uy * force;
      displacement.get(b).x += ux * force;
      displacement.get(b).y += uy * force;
    });

    ids.forEach((id) => {
      const d = displacement.get(id);
      const dist = Math.hypot(d.x, d.y);
      if (dist < 0.001) return;

      const move = Math.min(temperature, dist);
      const p = positions.get(id);
      p.x += (d.x / dist) * move;
      p.y += (d.y / dist) * move;
    });

    temperature *= 0.95;
  }

  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ids[i];
        const b = ids[j];
        const pa = positions.get(a);
        const pb = positions.get(b);
        let dx = pb.x - pa.x;
        let dy = pb.y - pa.y;
        const minX = tableWidth + 48;
        const minY = (tableHeights.get(a) + tableHeights.get(b)) / 2 + 36;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const sign = dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx);
          pa.x -= (overlapX / 2) * sign;
          pb.x += (overlapX / 2) * sign;
        } else {
          const sign = dy === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dy);
          pa.y -= (overlapY / 2) * sign;
          pb.y += (overlapY / 2) * sign;
        }
      }
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  ids.forEach((id) => {
    const p = positions.get(id);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  });

  const shifted = new Map();
  ids.forEach((id) => {
    const p = positions.get(id);
    shifted.set(id, {
      x: Math.round(p.x - minX + DEFAULT_PADDING),
      y: Math.round(p.y - minY + DEFAULT_PADDING),
    });
  });

  return shifted;
}

function orientation(a, b, c) {
  const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(val) < 1e-9) return 0;
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

function layoutScore(positions, tablesById, edges, tableWidth, tableHeights) {
  const segments = edges.map(([a, b]) => {
    const pa = positions.get(a);
    const pb = positions.get(b);
    return {
      a,
      b,
      p1: {
        x: pa.x + tableWidth / 2,
        y: pa.y + tableHeights.get(a) / 2,
      },
      p2: {
        x: pb.x + tableWidth / 2,
        y: pb.y + tableHeights.get(b) / 2,
      },
    };
  });

  let crossings = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.a === s2.a || s1.a === s2.b || s1.b === s2.a || s1.b === s2.b) {
        continue;
      }
      if (segmentsIntersect(s1.p1, s1.p2, s2.p1, s2.p2)) crossings++;
    }
  }

  const totalEdgeLength = segments.reduce((sum, s) => {
    return sum + Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
  }, 0);

  return { crossings, totalEdgeLength, positions, tablesById };
}

function bestLayout(candidates) {
  return candidates.sort((a, b) => {
    if (a.crossings !== b.crossings) return a.crossings - b.crossings;
    return a.totalEdgeLength - b.totalEdgeLength;
  })[0];
}

export function autoArrangeTables(
  tables,
  relationships = [],
  { algorithm = "hybrid", tableWidth = defaultTableWidth } = {},
) {
  if (!Array.isArray(tables) || tables.length <= 1) {
    return tables.map((t) => ({ ...t }));
  }

  const tableHeights = new Map(tables.map((t) => [t.id, tableHeight(t)]));
  const { edges } = buildGraph(tables, relationships);
  const tablesById = new Map(tables.map((t) => [t.id, t]));

  const candidates = [];
  if (algorithm === "hybrid" || algorithm === "layered") {
    const layered = layeredPositions(tables, relationships, tableWidth, tableHeights);
    candidates.push(
      layoutScore(layered, tablesById, edges, tableWidth, tableHeights),
    );
  }
  if (algorithm === "hybrid" || algorithm === "force") {
    const force = forceDirectedPositions(
      tables,
      relationships,
      tableWidth,
      tableHeights,
    );
    candidates.push(layoutScore(force, tablesById, edges, tableWidth, tableHeights));
  }

  if (candidates.length === 0) {
    return tables.map((t) => ({ ...t }));
  }

  const chosen = bestLayout(candidates);

  return tables.map((table) => {
    const pos = chosen.positions.get(table.id);
    if (!pos) return { ...table };
    return { ...table, x: pos.x, y: pos.y };
  });
}

export function arrangeTables(diagram) {
  const relationships = diagram.relationships || diagram.references || [];
  const arranged = autoArrangeTables(diagram.tables, relationships, {
    algorithm: "layered",
    tableWidth: 200,
  });

  arranged.forEach((table, index) => {
    diagram.tables[index].x = table.x;
    diagram.tables[index].y = table.y;
  });
}
