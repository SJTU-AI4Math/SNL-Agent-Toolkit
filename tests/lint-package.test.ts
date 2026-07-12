import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintPackage } from '../lib/lint-package.ts';

function codes(report: ReturnType<typeof lintPackage>): string[] {
  return report.issues.map((i) => i.code).sort();
}

describe('lintPackage', () => {
  it('accepts a well-formed fixed-arity package', () => {
    const pkg = {
      version: '0.4.0',
      name: 'core',
      description: 'core macros',
      macros: {
        R: {
          description: 'Real numbers',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [
            { tag: 'default', mode: 'formula_inline', template: '\\mathbb{R}' },
          ],
        },
        frac: {
          description: 'fraction',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [
            { tag: 'default', mode: 'formula_inline', template: '\\frac{#0}{#1}' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.deepEqual(r.issues, []);
  });

  it('accepts a well-formed dynamic-arity package', () => {
    const pkg = {
      version: '0.4.0',
      name: 'blocks',
      macros: {
        list: {
          description: 'ul',
          source: { entries: [], urls: [] },
          dynamic_arity: true,
          styles: [{ tag: 'default', mode: 'block', template: '<ul>#*</ul>' }],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.deepEqual(r.issues, []);
  });

  it('errors on missing top-level fields', () => {
    const r = lintPackage({});
    const c = codes(r);
    assert.ok(c.includes('package.missing-version'));
    assert.ok(c.includes('package.missing-name'));
    assert.ok(c.includes('package.missing-macros'));
  });

  it('errors on non-object payload', () => {
    const r = lintPackage([1, 2]);
    assert.deepEqual(codes(r), ['package.not-object']);
  });

  it('errors on macro missing dynamic_arity / styles', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        broken: {
          description: 'nope',
          source: { entries: [], urls: [] },
        },
      },
    };
    const r = lintPackage(pkg);
    const c = codes(r);
    assert.ok(c.includes('macro.missing-dynamic-arity'));
    assert.ok(c.includes('macro.missing-styles'));
  });

  it('errors on duplicate style tag within a macro', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [
            { tag: 'default', mode: 'formula_inline', template: 'a' },
            { tag: 'default', mode: 'text', template: 'b' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.duplicate-tag'));
  });

  it('errors on unknown mode', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [{ tag: 'default', mode: 'display', template: 'a' }],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.bad-mode'));
  });

  it('errors on #* in a non-dynamic macro', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [{ tag: 'default', mode: 'formula_inline', template: '(#*)' }],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.variadic-without-dynamic-arity'));
  });

  it('warns on dynamic macro whose default style lacks #*', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: true,
          styles: [
            { tag: 'default', mode: 'formula_inline', template: '\\Sigma' },
            { tag: 'sum', mode: 'formula_inline', template: '\\sum_{}#*' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    const issue = r.issues.find(
      (i) => i.code === 'macro.dynamic-arity-default-style-missing-variadic',
    );
    assert.ok(issue);
    assert.equal(issue!.severity, 'warning');
  });

  it('errors on illegal placeholder', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [{ tag: 'default', mode: 'text', template: '#foo #-1 ok' }],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.bad-placeholder'));
  });

  // Iroha 2026-07-11 regression: `\#` is a literal `#` per
  // fillLatexTemplate; scanTemplatePlaceholders was treating the char
  // after `\#` as a placeholder start and false-positive flagging
  // color hex codes like `\textcolor{\#ea580c}{...}` as bad
  // placeholders.
  it('accepts escaped `\\#` (literal hash) in templates', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [
            {
              tag: 'default',
              mode: 'formula_inline',
              template: '\\textcolor{\\#ea580c}{\\texttt{#0}}',
            },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(
      !codes(r).includes('style.bad-placeholder'),
      `unexpected bad-placeholder in: ${JSON.stringify(r)}`
    );
  });

  it('info-notes cross-style arity mismatch', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [
            { tag: 'default', mode: 'formula_inline', template: '#0 + #1' },
            { tag: 'alt', mode: 'formula_inline', template: '#0' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    const issue = r.issues.find((i) => i.code === 'macro.style-arity-mismatch');
    assert.ok(issue);
    assert.equal(issue!.severity, 'info');
  });
});
