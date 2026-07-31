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
          tags: [],
          styles: [
            { style_name: 'default', mode: 'formula_inline', template: '\\mathbb{R}', tags: [] },
          ],
        },
        frac: {
          description: 'fraction',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          tags: [],
          styles: [
            { style_name: 'default', mode: 'formula_inline', template: '\\frac{#0}{#1}', tags: [] },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.deepEqual(r.issues, []);
  });

  it('accepts a well-formed dynamic-arity package (#* and surrounding template text)', () => {
    const pkg = {
      version: '0.4.0',
      name: 'blocks',
      macros: {
        list: {
          description: 'ul',
          source: { entries: [], urls: [] },
          dynamic_arity: true,
          tags: [],
          styles: [
            {
              style_name: 'default',
              mode: 'block',
              template: '<ul>#*</ul>',
              separator: '',
              block_template_name: 'list',
              tags: [],
            },
          ],
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

  it('errors on duplicate style name within a macro', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: false,
          styles: [
            { style_name: 'default', mode: 'formula_inline', template: 'a' },
            { style_name: 'default', mode: 'text', template: 'b' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.duplicate-name'));
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
          styles: [{ style_name: 'default', mode: 'display', template: 'a' }],
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
          styles: [{ style_name: 'default', mode: 'formula_inline', template: '(#*)' }],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.variadic-without-dynamic-arity'));
  });

  it('requires #* in every dynamic macro style template', () => {
    const pkg = {
      version: '0.4.0',
      name: 'x',
      macros: {
        m: {
          description: 'x',
          source: { entries: [], urls: [] },
          dynamic_arity: true,
          styles: [
            { style_name: 'default', mode: 'formula_inline', template: '\\Sigma' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    const issue = r.issues.find(
      (i) => i.code === 'style.dynamic-arity-missing-variadic',
    );
    assert.ok(issue);
    assert.equal(issue!.severity, 'error');
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
          styles: [{ style_name: 'default', mode: 'text', template: '#foo #-1 ok' }],
        },
      },
    };
    const r = lintPackage(pkg);
    assert.ok(codes(r).includes('style.bad-placeholder'));
  });

  it('accepts only canonical numeric placeholders #0 through #99', () => {
    const lintTemplate = (template: string) => lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, dynamic_arity: false, tags: [],
          styles: [{ style_name: 'default', mode: 'text', template, tags: [] }] },
      },
    });

    for (const template of ['#', '##', '#00', '#100', '#999']) {
      assert.ok(
        codes(lintTemplate(template)).includes('style.bad-placeholder'),
        `${template} must fail closed as a malformed placeholder`,
      );
    }
    assert.ok(!codes(lintTemplate('#99')).includes('style.bad-placeholder'));
    assert.ok(!codes(lintTemplate('literal \\# and #0')).includes('style.bad-placeholder'));
  });

  // Iroha 2026-07-11 regression: `\#` is a literal `#` per the
  // SNL-Basics template filler; scanTemplatePlaceholders was treating the char
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
              style_name: 'default',
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

  it('allows composition-only partial macros to be KaTeX-incomplete in isolation', () => {
    const partial = {
      version: '0.10.0', name: 'x', macros: {
        fragment: {
          description: 'an aligned-row fragment that only compiles inside its parent',
          source: { entries: [], urls: [] }, kind: 'partial',
          dynamic_arity: true, tags: [],
          styles: [{
            style_name: 'default', mode: 'formula_display',
            template: '& =#*', separator: '\\\\ & =', tags: [],
          }],
        },
      },
    };
    const ordinary = structuredClone(partial);
    ordinary.macros.fragment.kind = 'rule';
    const unrelatedKind = structuredClone(partial);
    unrelatedKind.macros.fragment.kind = 'fragment';
    const malformedPartial = structuredClone(partial);
    malformedPartial.macros.fragment.styles[0].template = '& =x';

    assert.ok(codes(lintPackage(ordinary)).includes('style.katex-compile'));
    assert.ok(codes(lintPackage(unrelatedKind)).includes('style.katex-compile'));
    assert.ok(!codes(lintPackage(partial)).includes('style.katex-compile'));
    assert.ok(codes(lintPackage(malformedPartial)).includes('style.dynamic-arity-missing-variadic'));
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
            { style_name: 'default', mode: 'formula_inline', template: '#0 + #1' },
            { style_name: 'alt', mode: 'formula_inline', template: '#0' },
          ],
        },
      },
    };
    const r = lintPackage(pkg);
    const issue = r.issues.find((i) => i.code === 'macro.style-arity-mismatch');
    assert.ok(issue);
    assert.equal(issue!.severity, 'info');
  });

  it('requires macro and style tags arrays', () => {
    const r = lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, dynamic_arity: false,
          styles: [{ style_name: 'default', mode: 'text', template: '#0' }] },
      },
    });
    assert.ok(codes(r).includes('macro.missing-tags'));
    assert.ok(codes(r).includes('style.missing-tags'));
  });

  it('rejects block_template_name outside block mode', () => {
    const r = lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, dynamic_arity: false, tags: [],
          styles: [{ style_name: 'default', mode: 'text', template: '#0', block_template_name: 'list', tags: [] }] },
      },
    });
    assert.ok(codes(r).includes('style.block-template-non-block'));
  });

  it('rejects non-string separator', () => {
    const r = lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, dynamic_arity: true, tags: [],
          styles: [{ style_name: 'default', mode: 'text', template: '#*', separator: 1, tags: [] }] },
      },
    });
    assert.ok(codes(r).includes('style.bad-separator'));
  });

  it('rejects pre-v7 style fields even when v7 fields are also present', () => {
    const r = lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, dynamic_arity: true, tags: [],
          styles: [{
            style_name: 'default', mode: 'text', template: '#*', separator: '', tags: [],
            tag: 'legacy', variadic_join: ', ', react_renderer_key: 'list',
          }] },
      },
    });
    assert.equal(r.issues.filter((issue) => issue.code === 'style.legacy-field').length, 3);
  });

  it('enforces style-name grammar and backslash-free tags', () => {
    const r = lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, dynamic_arity: false, tags: ['bad\\tag'],
          styles: [{ style_name: 'not-valid!', mode: 'text', template: '#0', tags: ['bad\\tag'] }] },
      },
    });
    assert.ok(codes(r).includes('style.bad-name'));
    assert.ok(codes(r).includes('macro.bad-tags'));
    assert.ok(codes(r).includes('style.bad-tags'));
  });

  it('rejects a non-string optional macro kind', () => {
    const r = lintPackage({
      version: '0.10.0', name: 'x', macros: {
        m: { description: '', source: { entries: [], urls: [] }, kind: 7,
          dynamic_arity: false, tags: [],
          styles: [{ style_name: 'default', mode: 'text', template: 'm', tags: [] }] },
      },
    });
    assert.ok(codes(r).includes('macro.bad-kind'));
  });
});
