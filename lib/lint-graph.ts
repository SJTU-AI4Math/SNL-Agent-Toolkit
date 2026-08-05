/**
 * Lint one Library graph.json payload — the outline / branch tree for a
 * single library (`.SNL_Doc/libraries/<slug>/graph.json`, Library Graph v2).
 *
 * See docs/library-graph-spec.md in SNL-Doc-Extension for the authoritative
 * spec. This linter checks:
 *
 *   L1 — SCHEMA
 *        - top-level shape: { nodes: [], relationships: [] }
 *        - each node has string `id`, string `label`, object `props`
 *        - each relationship has string `from`, string `to`, string `label`
 *        - node ids are unique within the file
 *
 *   L2 — LABEL VOCABULARY
 *        - the only recognised node label is 'Entry' (v2)
 *        - the only recognised relationship label is 'branch' (v2)
 *        - unknown labels don't fail the file — the extension keeps them
 *          around round-trip — but each unknown label surfaces a warning
 *          so cat sees what's dangling. Matches the extension's behaviour
 *          per libraryGraph.ts jsdoc.
 *
 *   L3 — GRAPH INTEGRITY
 *        - every branch relationship's `from` and `to` reference an
 *          existing node id (dangling edges → error).
 *        - each Entry node has AT MOST ONE incoming branch (multi-parent
 *          → error; the numbering engine's parentOf walk assumes unique
 *          parent).
 *        - the branch subgraph has NO CYCLES (cycles → error; would
 *          hang numberFor's chain walk).
 *        - graph nodes with an `entryId` prop reference an entry that
 *          exists in the shared pool (`.SNL_Doc/entries/*.json`). Missing
 *          entryId is fine (placeholder node). Unresolvable entryId is
 *          an error — the graph promised a link that isn't there.
 *
 * All layers push into a LintReport instead of throwing; the caller checks
 * `hasErrors()` before writing.
 */

import type {
  EntryData,
  GraphNode,
  GraphRelationship,
  LibraryGraph,
} from './snl-doc-schema.ts';
import type { LintIssue, LintReport } from './lint-report.ts';

export interface LintGraphContext {
  /** All entries in the shared pool — used for entryId resolution. */
  poolEntries: EntryData[];
}

/**
 * Lint one already-JSON-parsed library graph. Returns a LintReport with
 * the `file` slot left unset (the caller — usually the CLI — fills it).
 */
export function lintGraph(raw: unknown, ctx: LintGraphContext): LintReport {
  const issues: LintIssue[] = [];

  // L1 — SCHEMA (top-level)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: 'error',
      code: 'graph.not-object',
      message: `graph.json must be a JSON object, got ${describe(raw)}.`,
    });
    return { issues };
  }
  const g = raw as Partial<LibraryGraph>;

  if (!Array.isArray(g.nodes)) {
    issues.push({
      severity: 'error',
      code: 'graph.missing-nodes',
      message: '`nodes` must be an array.',
      path: 'nodes',
    });
  }
  if (!Array.isArray(g.relationships)) {
    issues.push({
      severity: 'error',
      code: 'graph.missing-relationships',
      message: '`relationships` must be an array.',
      path: 'relationships',
    });
  }
  if (!Array.isArray(g.nodes) || !Array.isArray(g.relationships)) {
    // Can't do anything useful without both arrays.
    return { issues };
  }

  // L1 — nodes[]
  const seenNodeIds = new Set<string>();
  const nodes: GraphNode[] = [];
  g.nodes.forEach((rawNode, i) => {
    if (typeof rawNode !== 'object' || rawNode === null || Array.isArray(rawNode)) {
      issues.push({
        severity: 'error',
        code: 'graph.node.not-object',
        message: `nodes[${i}] must be an object.`,
        path: `nodes[${i}]`,
      });
      return;
    }
    const n = rawNode as Partial<GraphNode>;
    if (typeof n.id !== 'string' || n.id === '') {
      issues.push({
        severity: 'error',
        code: 'graph.node.missing-id',
        message: `nodes[${i}].id must be a non-empty string.`,
        path: `nodes[${i}].id`,
      });
      return;
    }
    if (typeof n.label !== 'string' || n.label === '') {
      issues.push({
        severity: 'error',
        code: 'graph.node.missing-label',
        message: `nodes[${i}].label must be a non-empty string.`,
        path: `nodes[${i}].label`,
      });
    } else if (n.label !== 'Entry') {
      // L2 — unknown node label = warning, not error
      issues.push({
        severity: 'warning',
        code: 'graph.node.unknown-label',
        message:
          `nodes[${i}].label = '${n.label}' — v2 only understands 'Entry'. ` +
          `The node is kept as-is on disk but ignored by the numbering engine.`,
        path: `nodes[${i}].label`,
      });
    }
    if (typeof n.props !== 'object' || n.props === null || Array.isArray(n.props)) {
      issues.push({
        severity: 'error',
        code: 'graph.node.missing-props',
        message: `nodes[${i}].props must be an object (may be empty {}).`,
        path: `nodes[${i}].props`,
      });
    }
    if (seenNodeIds.has(n.id)) {
      issues.push({
        severity: 'error',
        code: 'graph.node.duplicate-id',
        message: `nodes[${i}].id '${n.id}' is not unique within this library.`,
        path: `nodes[${i}].id`,
      });
      return;
    }
    seenNodeIds.add(n.id);
    nodes.push(n as GraphNode);
  });

  // L1 — relationships[]
  const relationships: GraphRelationship[] = [];
  g.relationships.forEach((rawRel, i) => {
    if (typeof rawRel !== 'object' || rawRel === null || Array.isArray(rawRel)) {
      issues.push({
        severity: 'error',
        code: 'graph.rel.not-object',
        message: `relationships[${i}] must be an object.`,
        path: `relationships[${i}]`,
      });
      return;
    }
    const r = rawRel as Partial<GraphRelationship>;
    let bad = false;
    if (typeof r.from !== 'string' || r.from === '') {
      issues.push({
        severity: 'error',
        code: 'graph.rel.missing-from',
        message: `relationships[${i}].from must be a non-empty string.`,
        path: `relationships[${i}].from`,
      });
      bad = true;
    }
    if (typeof r.to !== 'string' || r.to === '') {
      issues.push({
        severity: 'error',
        code: 'graph.rel.missing-to',
        message: `relationships[${i}].to must be a non-empty string.`,
        path: `relationships[${i}].to`,
      });
      bad = true;
    }
    if (typeof r.label !== 'string' || r.label === '') {
      issues.push({
        severity: 'error',
        code: 'graph.rel.missing-label',
        message: `relationships[${i}].label must be a non-empty string.`,
        path: `relationships[${i}].label`,
      });
      bad = true;
    } else if (r.label !== 'branch') {
      // L2 — unknown relationship label = warning, ignored by engine.
      issues.push({
        severity: 'warning',
        code: 'graph.rel.unknown-label',
        message:
          `relationships[${i}].label = '${r.label}' — v2 only understands 'branch'. ` +
          `Kept as-is but ignored by the numbering engine.`,
        path: `relationships[${i}].label`,
      });
    }
    if (!bad) relationships.push(r as GraphRelationship);
  });

  // L3 — GRAPH INTEGRITY (branch subgraph only)
  const branchRels = relationships.filter((r) => r.label === 'branch');

  // Dangling from/to → error.
  branchRels.forEach((r, i) => {
    // Global index is what the user sees, so recompute — walk both arrays
    // in tandem. Simpler: just use the position within the branch-filtered
    // list plus a hint. We're not that pedantic; the message names the ids.
    if (!seenNodeIds.has(r.from)) {
      issues.push({
        severity: 'error',
        code: 'graph.rel.dangling-from',
        message: `Branch relationship references unknown node id '${r.from}' as parent.`,
        path: `relationships (branch #${i})`,
      });
    }
    if (!seenNodeIds.has(r.to)) {
      issues.push({
        severity: 'error',
        code: 'graph.rel.dangling-to',
        message: `Branch relationship references unknown node id '${r.to}' as child.`,
        path: `relationships (branch #${i})`,
      });
    }
  });

  // Multi-parent detection.
  const parentCount = new Map<string, number>();
  for (const r of branchRels) {
    if (!seenNodeIds.has(r.to)) continue;
    parentCount.set(r.to, (parentCount.get(r.to) ?? 0) + 1);
  }
  for (const [nodeId, cnt] of parentCount) {
    if (cnt > 1) {
      issues.push({
        severity: 'error',
        code: 'graph.multi-parent',
        message:
          `Node '${nodeId}' has ${cnt} incoming branch edges. ` +
          `Each Entry node must have at most one branch parent.`,
        path: `nodes (id=${nodeId})`,
      });
    }
  }

  // Cycle detection (DFS through the parent-map view).
  const cyclesFound = detectCycles(branchRels, seenNodeIds);
  for (const cycle of cyclesFound) {
    issues.push({
      severity: 'error',
      code: 'graph.cycle',
      message:
        `Branch subgraph contains a cycle: ${cycle.join(' -> ')}. ` +
        `The numbering engine's chain walk would loop forever.`,
      path: 'relationships',
    });
  }

  // Entry ID resolution.
  const poolIds = new Set(ctx.poolEntries.map((e) => e.id));
  for (const n of nodes) {
    if (n.label !== 'Entry') continue;
    const entryId = n.props?.entryId;
    if (entryId === undefined || entryId === null || entryId === '') {
      // Placeholder node — fine.
      continue;
    }
    if (typeof entryId !== 'string') {
      issues.push({
        severity: 'error',
        code: 'graph.node.bad-entry-id-type',
        message: `Node '${n.id}'.props.entryId must be a string when present.`,
        path: `nodes (id=${n.id}).props.entryId`,
      });
      continue;
    }
    if (!poolIds.has(entryId)) {
      issues.push({
        severity: 'error',
        code: 'graph.node.entry-not-in-pool',
        message:
          `Node '${n.id}'.props.entryId = '${entryId}' does not exist in the ` +
          `shared Entry entity pool (.SNL_Doc/entries/*.json).`,
        path: `nodes (id=${n.id}).props.entryId`,
      });
    }
  }

  return { issues };
}

/**
 * Return the list of cycles in the branch subgraph. Each cycle is a chain
 * `[a, b, ..., a]` naming the nodes in traversal order. Uses a per-node
 * WHITE / GRAY / BLACK colouring — the standard DFS cycle-detection.
 *
 * Only cycles reachable via `branch` edges are reported (matches what the
 * numbering engine walks). Nodes not in the branch subgraph are ignored.
 */
function detectCycles(
  branchRels: GraphRelationship[],
  nodeIds: Set<string>,
): string[][] {
  // Build adjacency: parent -> children (in declaration order).
  const children = new Map<string, string[]>();
  for (const r of branchRels) {
    if (!nodeIds.has(r.from) || !nodeIds.has(r.to)) continue;
    const list = children.get(r.from);
    if (list) list.push(r.to);
    else children.set(r.from, [r.to]);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];
  const found: string[][] = [];

  const visit = (nodeId: string): void => {
    colour.set(nodeId, GRAY);
    stack.push(nodeId);
    for (const c of children.get(nodeId) ?? []) {
      const state = colour.get(c) ?? WHITE;
      if (state === GRAY) {
        // Back-edge — cycle from c to current.
        const idx = stack.indexOf(c);
        const chain = stack.slice(idx).concat([c]);
        found.push(chain);
      } else if (state === WHITE) {
        visit(c);
      }
    }
    stack.pop();
    colour.set(nodeId, BLACK);
  };

  for (const id of nodeIds) {
    if ((colour.get(id) ?? WHITE) === WHITE) visit(id);
  }
  return found;
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
