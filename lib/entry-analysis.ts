import { resolveSnlSemantics } from '@sjtu-ai4math/snl-basics';
import { extractExportedBinders, tryParseSnlSyntaxTree, type SnlMacroSourceLookup, type SnlSyntaxTree } from '@sjtu-ai4math/snl-basics/core';
import type { EntryData, MacroPackageEntry } from './snl-doc-schema.ts';
import { readActiveMacros, readEntries } from './snl-doc.ts';
import { renderTreeAsLatex, type SynthResult } from './snl-render.ts';

export class EntryAnalysisError extends Error {
  public constructor(public readonly code: 'entry.not-found' | 'entry.invalid', message: string) {
    super(message);
    this.name = 'EntryAnalysisError';
  }
}

export interface SnlStructuralMetrics {
  weakSemanticFreedom: number;
  strongSemanticFreedom: number;
  weightedTotal: number;
  weightedWeakSemanticFreedom: number;
  weightedStrongSemanticFreedom: number;
  structuralIndex: number;
}

function metadata(node: SnlSyntaxTree): Record<string, unknown> {
  return node.mdata && typeof node.mdata === 'object' ? node.mdata as Record<string, unknown> : {};
}

function contextIndex(entries: EntryData[]): Map<string, Set<string>> {
  return new Map(entries.map((entry) => [entry.id, extractExportedBinders(entry.content?.snl ?? '')]));
}

function entrySourceId(node: SnlSyntaxTree): string {
  if (node.source?.type === 'entry') return node.source.entry_id;
  if (node.postfix?.type === 'name') return node.postfix.name;
  const legacy = metadata(node).src;
  return typeof legacy === 'string' ? legacy : '';
}

function applyContextLookup(tree: SnlSyntaxTree, index: Map<string, Set<string>>): void {
  const visit = (node: SnlSyntaxTree): void => {
    const meta = metadata(node);
    const src = entrySourceId(node);
    if (src && node.kind !== 'binder') {
      const declarations = index.get(src);
      if (!declarations) {
        node.kind = 'fvar';
        node.source = undefined;
        node.mdata = { ...meta, srcStatus: 'dangling' };
      } else if (!declarations.has(semanticName(node))) {
        node.kind = 'fvar';
        node.source = undefined;
        node.mdata = { ...meta, srcStatus: 'srcResolvedNoDecl' };
      } else {
        node.kind = 'bvar';
        node.source = { type: 'entry', entry_id: src };
        const { srcStatus: _status, ...clean } = meta;
        node.mdata = Object.keys(clean).length ? clean : null;
      }
    }
    node.children.forEach(visit);
  };
  visit(tree);
}

function countTokens(text: string): number {
  return text.match(/[\p{Script=Han}]|[\p{L}\p{M}\p{N}]+/gu)?.length ?? 0;
}
function nodeWeight(name: string): number {
  return 1 + 0.2 * Math.log2(1 + Math.max(0, countTokens(name) - 6));
}
function semanticName(node: SnlSyntaxTree): string {
  return node.temporary_source ?? node.binder_name ?? node.macro_name;
}

function numeric(node: SnlSyntaxTree): boolean {
  return node.children.length === 0 && node.env_mode !== 'text' && node.env_mode !== 'block' && node.kind !== 'binder' && node.kind !== 'bvar' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(semanticName(node).trim());
}

export function analyzeStructuralIndex(root: SnlSyntaxTree, macros: SnlMacroSourceLookup, entryIds: ReadonlySet<string>): SnlStructuralMetrics {
  const binders = new Set<string>();
  const collect = (node: SnlSyntaxTree): void => { if (node.kind === 'binder') binders.add(node.binder_name ?? node.temporary_source ?? node.macro_name); node.children.forEach(collect); };
  collect(root);
  let weakSemanticFreedom = 0, strongSemanticFreedom = 0, weightedTotal = 0, weightedWeakSemanticFreedom = 0, weightedStrongSemanticFreedom = 0;
  const walk = (node: SnlSyntaxTree): void => {
    if (!numeric(node)) {
      const meta = metadata(node), src = entrySourceId(node), bindRef = typeof meta.bindRef === 'string' ? meta.bindRef : '', srcStatus = typeof meta.srcStatus === 'string' ? meta.srcStatus : '';
      const macro = Object.hasOwn(macros, node.macro_name) ? macros[node.macro_name] : undefined;
      const catalogConstant = !src && !node.env_mode && !['fvar', 'bvar', 'binder'].includes(node.kind ?? '') && Boolean(macro);
      let sourced = node.kind === 'binder';
      if (src) sourced = node.kind === 'bvar' && !srcStatus && entryIds.has(src);
      else if (node.kind === 'bvar' && node.source?.type === 'tree_path') sourced = true;
      else if (node.kind === 'bvar' && bindRef && binders.has(node.macro_name)) sourced = true;
      else if (!node.env_mode && node.kind !== 'fvar' && node.kind !== 'bvar' && macro) sourced = (macro.source?.urls ?? []).some(Boolean) || (macro.source?.entries ?? []).some((id) => entryIds.has(id));
      const weight = catalogConstant || node.kind === 'binder' || (node.kind === 'bvar' && sourced) ? 1 : nodeWeight(semanticName(node));
      weightedTotal += weight;
      if (!sourced) { strongSemanticFreedom++; weightedStrongSemanticFreedom += weight; if (!catalogConstant) { weakSemanticFreedom++; weightedWeakSemanticFreedom += weight; } }
    }
    node.children.forEach(walk);
  };
  walk(root);
  return { weakSemanticFreedom, strongSemanticFreedom, weightedTotal, weightedWeakSemanticFreedom, weightedStrongSemanticFreedom, structuralIndex: weightedTotal === 0 ? 1 : Math.min(1, Math.max(0, 1 - weightedStrongSemanticFreedom / weightedTotal)) };
}

async function loadEntry(root: string, id: string): Promise<{ entry: EntryData; entries: EntryData[]; macros: Record<string, MacroPackageEntry> }> {
  const [entries, macros] = await Promise.all([readEntries(root), readActiveMacros(root)]);
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new EntryAnalysisError('entry.not-found', `Entry not found: ${id}`);
  return { entry, entries, macros };
}

function parseEntry(entry: EntryData, macros: Record<string, MacroPackageEntry>): SnlSyntaxTree {
  const snl = entry.content?.snl;
  if (typeof snl !== 'string' || !snl.trim()) throw new EntryAnalysisError('entry.invalid', `Entry ${entry.id} has no SNL content.`);
  const parsed = tryParseSnlSyntaxTree(snl);
  if (!parsed.ok) throw new EntryAnalysisError('entry.invalid', `Entry ${entry.id} SNL parse failed: ${parsed.error}`);
  return resolveSnlSemantics(
    parsed.tree,
    macros as unknown as Parameters<typeof resolveSnlSemantics>[1],
  ).tree;
}

export async function computeEntrySsi(root: string, id: string): Promise<SnlStructuralMetrics> {
  const { entry, entries, macros } = await loadEntry(root, id);
  const tree = parseEntry(entry, macros);
  applyContextLookup(tree, contextIndex(entries));
  return analyzeStructuralIndex(tree, macros, new Set(entries.map((candidate) => candidate.id)));
}

export async function computeEntryBareLatex(root: string, id: string): Promise<SynthResult> {
  const { entry, macros } = await loadEntry(root, id);
  try {
    const rendered = renderTreeAsLatex(parseEntry(entry, macros), macros);
    if (rendered.output.includes('\\htmlData')) {
      throw new EntryAnalysisError(
        'entry.invalid',
        `Entry ${entry.id} bare LaTeX synthesis produced forbidden \\htmlData.`,
      );
    }
    return rendered;
  } catch (error) {
    if (error instanceof EntryAnalysisError) throw error;
    throw new EntryAnalysisError(
      'entry.invalid',
      error instanceof Error ? error.message : String(error),
    );
  }
}
