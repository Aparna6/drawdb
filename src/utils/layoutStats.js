/**
 * Compute layout statistics for the current diagram.
 * @param {{ id: string|number }[]} tables
 * @param {{ startTableId: string|number, endTableId: string|number }[]} relationships
 * @param {{ length: number }[]} [areas] - optional, for area count
 * @param {{ length: number }[]} [notes] - optional, for note count
 * @returns {{ tableCount: number, relationshipCount: number, maxDepth: number, totalFields: number, areaCount: number, noteCount: number }}
 */
export function getLayoutStats(tables, relationships, areas = [], notes = []) {
  const tableCount = tables.length;
  const relationshipCount = relationships.length;
  const totalFields = tables.reduce((sum, t) => sum + (t.fields?.length ?? 0), 0);
  const areaCount = areas.length;
  const noteCount = notes.length;

  let maxDepth = 0;
  if (relationships.length > 0 && tables.length > 0) {
    const idToIndex = new Map();
    tables.forEach((t, i) => idToIndex.set(String(t.id), i));
    const n = tables.length;
    const adj = Array.from({ length: n }, () => []);
    relationships.forEach((r) => {
      const u = idToIndex.get(String(r.startTableId));
      const v = idToIndex.get(String(r.endTableId));
      if (u !== undefined && v !== undefined && u !== v) {
        if (!adj[u].includes(v)) adj[u].push(v);
        if (!adj[v].includes(u)) adj[v].push(u);
      }
    });

    for (let start = 0; start < n; start++) {
      const dist = new Array(n).fill(-1);
      dist[start] = 0;
      const queue = [start];
      while (queue.length > 0) {
        const u = queue.shift();
        for (const v of adj[u]) {
          if (dist[v] === -1) {
            dist[v] = dist[u] + 1;
            queue.push(v);
          }
        }
      }
      const maxFromStart = Math.max(...dist.filter((d) => d >= 0), 0);
      maxDepth = Math.max(maxDepth, maxFromStart);
    }
  }

  return {
    tableCount,
    relationshipCount,
    maxDepth,
    totalFields,
    areaCount,
    noteCount,
  };
}
