// Waypoint graph for walking between anchors (tiny Dijkstra; no navmesh library needed).
import type { AnchorId, LocationManifest, Vec3 } from "@/world/locations/schema";

export interface NavGraph { nodes: Record<string, Vec3>; adj: Record<string, string[]> }
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function buildNav(loc: LocationManifest): NavGraph {
  const nodes: Record<string, Vec3> = { ...loc.waypoints.nodes };
  for (const [id, a] of Object.entries(loc.anchors)) nodes[id] = a.pos;
  const adj: Record<string, string[]> = Object.fromEntries(Object.keys(nodes).map((k) => [k, []]));
  for (const [a, b] of loc.waypoints.edges) { adj[a]?.push(b); adj[b]?.push(a); }
  return { nodes, adj };
}

/** Shortest path of points from one anchor to another (inclusive), or null if unreachable. */
export function findPath(nav: NavGraph, from: AnchorId | string, to: AnchorId | string): Vec3[] | null {
  if (!nav.nodes[from] || !nav.nodes[to]) return null;
  const best: Record<string, number> = { [from]: 0 }, prev: Record<string, string> = {};
  const open = new Set([from]);
  while (open.size) {
    let cur = ""; for (const n of open) if (!cur || best[n] < best[cur]) cur = n;
    open.delete(cur);
    if (cur === to) break;
    for (const nb of nav.adj[cur]) {
      const d = best[cur] + dist(nav.nodes[cur], nav.nodes[nb]);
      if (best[nb] === undefined || d < best[nb]) { best[nb] = d; prev[nb] = cur; open.add(nb); }
    }
  }
  if (best[to] === undefined) return null;
  const ids = [to]; while (ids[0] !== from) ids.unshift(prev[ids[0]]);
  return ids.map((id) => nav.nodes[id]);
}

export const pathLength = (p: Vec3[]) => p.slice(1).reduce((s, q, i) => s + dist(p[i], q), 0);

/** Position and heading along a path at fraction f ∈ [0,1] (by distance). */
export function pointAlong(p: Vec3[], f: number): { pos: Vec3; yaw: number } {
  if (f <= 0 || p.length < 2) return { pos: p[0], yaw: p.length > 1 ? Math.atan2(p[1][0] - p[0][0], p[1][2] - p[0][2]) : 0 };
  if (f >= 1) { const a = p[p.length - 2], b = p[p.length - 1]; return { pos: b, yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) }; }
  const total = pathLength(p);
  let left = Math.min(1, Math.max(0, f)) * total;
  for (let i = 1; i < p.length; i++) {
    const seg = dist(p[i - 1], p[i]);
    if (left <= seg || i === p.length - 1) {
      const k = seg ? Math.min(1, left / seg) : 1;
      const a = p[i - 1], b = p[i];
      return { pos: [a[0] + (b[0] - a[0]) * k, 0, a[2] + (b[2] - a[2]) * k], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    left -= seg;
  }
  return { pos: p[p.length - 1], yaw: 0 };
}
