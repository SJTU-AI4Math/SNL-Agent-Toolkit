/**
 * Thin re-export wrapper for the SNL-Basics parser, imported straight from
 * the git submodule at ../external/SNL-Basics. The parser has no runtime
 * dependencies (no React, no KaTeX) — it's a pure TS module —, so tsx can
 * execute it directly without a build step.
 *
 * Kept as a wrapper so the rest of the toolkit imports from a stable local
 * path; if SNL-Basics ever ships an npm package we swap this file's imports
 * and everything downstream stays put.
 */

export {
  parseSnlSyntaxTree,
  SnlSyntaxTreeParseError,
} from '../external/SNL-Basics/src/snl-syntax-tree/parser.ts';

export type { SnlSyntaxTree } from '../external/SNL-Basics/src/snl-syntax-tree/types.ts';

import {
  parseSnlSyntaxTree,
  SnlSyntaxTreeParseError,
} from '../external/SNL-Basics/src/snl-syntax-tree/parser.ts';
import type { SnlSyntaxTree } from '../external/SNL-Basics/src/snl-syntax-tree/types.ts';

/**
 * Non-throwing parse — mirrors the react-view `tryParseSnlSyntaxTree`
 * helper but avoids pulling in the react-view module (which has React
 * imports we don't want in a CLI).
 */
export function tryParseSnlSyntaxTree(
  input: string,
): { ok: true; tree: SnlSyntaxTree } | { ok: false; error: string; position?: number } {
  try {
    return { ok: true, tree: parseSnlSyntaxTree(input) };
  } catch (e) {
    if (e instanceof SnlSyntaxTreeParseError) {
      return { ok: false, error: e.message, position: e.position };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
