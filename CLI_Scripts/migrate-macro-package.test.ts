import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintPackage } from '../lib/lint-package.ts';
import { migrateMacroPackageV6toV8 } from '../lib/snl-doc-schema.ts';

describe('migrateMacroPackageV6toV8', () => {
  it('restores each map key as the transient macro name and produces lint-clean v8', () => {
    const v6 = {
      version: '0.9.7',
      name: 'legacy-demo',
      description: 'package version is preserved',
      macros: {
        List: {
          name: 'stale-value-name',
          description: 'list',
          source: { entries: ['entry.list'], urls: [] },
          dynamic_arity: true,
          styles: [{
            tag: 'default',
            mode: 'block',
            template: 'ignored-v6-body',
            variadic_left: '<ul>',
            variadic_join: '',
            variadic_right: '</ul>',
            react_renderer_key: 'list',
            tags: [],
            markdown: '* #*',
          }],
        },
      },
    } as const;

    const migrated = migrateMacroPackageV6toV8(v6);

    assert.equal(migrated.version, '8');
    assert.equal('name' in migrated.macros.List, false);
    assert.equal(migrated.macros.List.styles[0].style_name, 'default');
    assert.equal(migrated.macros.List.styles[0].template, '<ul>#*</ul>');
    assert.equal(migrated.macros.List.styles[0].separator, '');
    assert.equal(migrated.macros.List.styles[0].block_template_name, 'list');
    assert.equal(migrated.macros.List.styles[0].markdown, '* #*');
    assert.deepEqual(lintPackage(migrated).issues, []);
    assert.equal(v6.macros.List.name, 'stale-value-name', 'adapter must not mutate input');
    assert.equal(v6.macros.List.styles[0].tag, 'default');
  });

  it('rejects malformed package maps instead of silently dropping data', () => {
    assert.throws(
      () => migrateMacroPackageV6toV8({ version: '0.9.0', name: 'bad', macros: [] }),
      /macros must be an object map/,
    );
    assert.throws(
      () => migrateMacroPackageV6toV8({ version: '0.9.0', name: 'bad', macros: { Missing: null } }),
      /macros\.Missing must be an object/,
    );
  });
});
