/**
 * Thin re-export wrapper for the SNL-Basics parser, imported from the published `@sjtu-ai4math/snl-basics/core` export.
 * The core parser API is pure and safe for a headless CLI.
 *
 * Kept as a wrapper so the rest of the toolkit imports from a stable local
 * path; the rest of the toolkit stays insulated from upstream import-path changes.
 */

export {
  parseSnlSyntaxTree,
  SnlSyntaxTreeParseError,
} from '@sjtu-ai4math/snl-basics/core';

export type { SnlSyntaxTree } from '@sjtu-ai4math/snl-basics/core';

import {
  parseSnlSyntaxTree,
  SnlSyntaxTreeParseError,
} from '@sjtu-ai4math/snl-basics/core';
import type { SnlSyntaxTree } from '@sjtu-ai4math/snl-basics/core';

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
