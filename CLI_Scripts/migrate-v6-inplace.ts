/**
 * One-off: migrate on-disk Macro v6 packages in a legacy .SNL_Doc workspace to v8.
 * Usage: tsx CLI_Scripts/migrate-v6-inplace.ts <workspaceRoot> <pkg> [pkg...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrateMacroPackageV6toV8 } from '../lib/migrate-macro-package.ts';

const [root, ...names] = process.argv.slice(2);
if (!root || names.length === 0) {
  console.error('usage: migrate-v6-inplace.ts <root> <pkgName>...');
  process.exit(2);
}
const config = JSON.parse(readFileSync(join(root, '.SNL_Doc', 'config.json'), 'utf8'));
if (config?.entity_storage?.version === 1) {
  console.error('migrate-v6-inplace.ts is legacy-only and refuses frozen term_macros backups in an entity-storage workspace.');
  process.exit(2);
}
for (const name of names) {
  const p = join(root, '.SNL_Doc', 'term_macros', `${name}.json`);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const migrated = migrateMacroPackageV6toV8(raw);
  writeFileSync(p, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
  console.log(`migrated ${name} (${Object.keys(migrated.macros).length} macros)`);
}
