/**
 * Minimal CLI argument parser. We deliberately don't depend on `commander`
 * or `yargs` — the toolkit's CLIs each take at most a few flags, and a
 * plain-JS parser is easier for agents to introspect via `--help`.
 *
 * Supports:
 *   --flag value       long flag w/ value
 *   --flag=value       long flag w/ = value
 *   --flag             boolean flag
 *   -f value           short flag w/ value (single char only)
 *   -f                 short boolean flag
 *   positional         first non-flag token onward
 *
 * Everything after a bare `--` becomes positional.
 */

export interface ParsedArgs {
  /** Boolean flags & string flags, keyed by long name (short aliases resolved). */
  flags: Record<string, string | boolean>;
  /** Everything not consumed as a flag, in original order. */
  positional: string[];
}

export interface FlagSpec {
  /** Long name — always kebab-case, e.g. 'root', 'entry-id'. */
  name: string;
  /** Optional single-char alias. */
  short?: string;
  /** True = takes a value (default). False = boolean flag. */
  hasValue?: boolean;
  /** Default value if the flag is absent. */
  default?: string | boolean;
  /** Short help line surfaced by printUsage. */
  help?: string;
}

/**
 * Parse `argv` (typically `process.argv.slice(2)`) against `specs`. Unknown
 * flags throw with a helpful message. Missing values on `hasValue` flags
 * also throw.
 */
export function parseArgs(argv: string[], specs: FlagSpec[]): ParsedArgs {
  const bySpec: Record<string, FlagSpec> = {};
  const shortAlias: Record<string, string> = {};
  for (const s of specs) {
    bySpec[s.name] = s;
    if (s.short) shortAlias[s.short] = s.name;
  }

  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (const s of specs) {
    if (s.default !== undefined) flags[s.name] = s.default;
  }

  let i = 0;
  let seenDashDash = false;
  while (i < argv.length) {
    const tok = argv[i];
    if (seenDashDash) {
      positional.push(tok);
      i++;
      continue;
    }
    if (tok === '--') {
      seenDashDash = true;
      i++;
      continue;
    }
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const inlineVal = eq === -1 ? undefined : tok.slice(eq + 1);
      const spec = bySpec[name];
      if (!spec) throw new Error(`Unknown flag: --${name}`);
      if (spec.hasValue === false) {
        if (inlineVal !== undefined) {
          throw new Error(`Flag --${name} is boolean; did you mean --${name}?`);
        }
        flags[name] = true;
        i++;
      } else {
        if (inlineVal !== undefined) {
          flags[name] = inlineVal;
          i++;
        } else {
          const next = argv[i + 1];
          if (next === undefined || next.startsWith('-')) {
            throw new Error(`Flag --${name} requires a value`);
          }
          flags[name] = next;
          i += 2;
        }
      }
    } else if (tok.startsWith('-') && tok.length === 2) {
      const short = tok.slice(1);
      const name = shortAlias[short];
      if (!name) throw new Error(`Unknown flag: -${short}`);
      const spec = bySpec[name];
      if (spec.hasValue === false) {
        flags[name] = true;
        i++;
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          throw new Error(`Flag -${short} (--${name}) requires a value`);
        }
        flags[name] = next;
        i += 2;
      }
    } else {
      positional.push(tok);
      i++;
    }
  }

  return { flags, positional };
}

/** Format a --help block from the CLI's flag specs and a short blurb. */
export function formatUsage(
  cliName: string,
  synopsis: string,
  specs: FlagSpec[],
): string {
  const lines = [`Usage: ${cliName} ${synopsis}`, '', 'Options:'];
  for (const s of specs) {
    const flagStr = s.short ? `-${s.short}, --${s.name}` : `    --${s.name}`;
    const kind = s.hasValue === false ? '' : ' <value>';
    const dflt =
      s.default !== undefined ? ` (default: ${JSON.stringify(s.default)})` : '';
    lines.push(`  ${flagStr}${kind}${dflt}`);
    if (s.help) lines.push(`      ${s.help}`);
  }
  return lines.join('\n');
}

/** Standard --root flag every CLI accepts. */
export const ROOT_FLAG: FlagSpec = {
  name: 'root',
  short: 'r',
  hasValue: true,
  default: '.',
  help: 'Path to the workspace containing .SNL_Doc/ (defaults to $PWD).',
};

/** Standard --json flag for CLIs that support machine-readable output. */
export const JSON_FLAG: FlagSpec = {
  name: 'json',
  hasValue: false,
  default: false,
  help: 'Output JSON instead of human-readable text.',
};

/** Standard --help flag. */
export const HELP_FLAG: FlagSpec = {
  name: 'help',
  short: 'h',
  hasValue: false,
  default: false,
  help: 'Show usage and exit.',
};
