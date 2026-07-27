/**
 * One-off: migrate on-disk Macro v6 packages in a .SNL_Doc workspace to v7.
 * Usage: tsx CLI_Scripts/migrate-v6-inplace.ts <workspaceRoot> <pkg> [pkg...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrateMacroPackageV6toV7 } from '../lib/migrate-macro-package.ts';

const [root, ...names] = process.argv.slice(2);
if (!root || names.length === 0) {
  console.error('usage: migrate-v6-inplace.ts <root> <pkgName>...');
  process.exit(2);
}
for (const name of names) {
  const p = join(root, '.SNL_Doc', 'term_macros', `${name}.json`);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const migrated = migrateMacroPackageV6toV7(raw);
  writeFileSync(p, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
  console.log(`migrated ${name} (${Object.keys(migrated.macros).length} macros)`);
}
