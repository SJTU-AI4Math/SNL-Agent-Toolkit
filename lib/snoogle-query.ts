import Fuse, { type FuseResult } from 'fuse.js';
import { readAllMacroPackages, readConfig, readEntries } from './snl-doc.ts';

export type SnoogleMode = 'entry' | 'macro';
export type SnoogleFieldTier = 'primary' | 'secondary' | 'tertiary';

export interface SnoogleSearchFields {
  primary: readonly string[];
  secondary: readonly string[];
  tertiary: readonly string[];
}

export interface SnoogleSearchDocument<T> {
  id: string;
  value: T;
  fields: SnoogleSearchFields;
}

export interface SnoogleRankedResult<T> {
  value: T;
  score: number;
  tokenScores: number[];
}

export interface SnoogleSearchOptions {
  fieldWeights?: Partial<Record<SnoogleFieldTier, number>>;
  minTokenScore?: number;
  fuseThreshold?: number;
}

export interface SnoogleSearchCandidate {
  id: string;
  labels: readonly string[];
}

export interface SnoogleEntryHit {
  kind: 'entry';
  id: string;
  title: string;
  entryKind: string | null;
  score: number;
}

export interface SnoogleMacroHit {
  kind: 'macro';
  id: string;
  packageId: string;
  packageName: string;
  macroKind: string | null;
  tags: string[];
  sourceEntries: string[];
  score: number;
}

export type SnoogleHit = SnoogleEntryHit | SnoogleMacroHit;

export interface SnoogleQueryResponse {
  schemaVersion: 1;
  mode: SnoogleMode;
  query: string;
  results: SnoogleHit[];
}

interface IndexedField {
  documentIndex: number;
  text: string;
  tier: SnoogleFieldTier;
}

const FIELD_WEIGHTS: Record<SnoogleFieldTier, number> = {
  primary: 1,
  secondary: 0.85,
  tertiary: 0.65,
};
const ALL_TIERS: readonly SnoogleFieldTier[] = ['primary', 'secondary', 'tertiary'];
const TAIL_TIERS: readonly SnoogleFieldTier[] = ['primary', 'secondary'];
const MIDDLE_TIERS: readonly SnoogleFieldTier[] = ['tertiary'];

export function tokenizeSnoogleQuery(query: string): string[] {
  return query.trim().split(/\s+/u).filter(Boolean);
}

export function expandSnoogleToken(token: string): Array<{ text: string; tiers: readonly SnoogleFieldTier[] }> {
  if (!token.includes('.')) return [{ text: token, tiers: ALL_TIERS }];
  const segments = token.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length <= 1) return segments.length === 0 ? [] : [{ text: segments[0], tiers: ALL_TIERS }];
  return [
    { text: segments.at(-1)!, tiers: TAIL_TIERS },
    ...segments.slice(0, -1).map((text) => ({ text, tiers: MIDDLE_TIERS })),
  ];
}

function exactnessFactor(needle: string, fieldText: string): number {
  const field = fieldText.toLowerCase();
  if (needle === field) return 1;
  if (field.length === 0) return 0.85;
  const coverage = Math.min(1, needle.length / field.length);
  return (field.startsWith(needle) ? 0.9 : 0.85) * (0.6 + 0.4 * coverage);
}

export class SnoogleSearchIndex<T> {
  private readonly documents: readonly SnoogleSearchDocument<T>[];
  private readonly weights: Record<SnoogleFieldTier, number>;
  private readonly minTokenScore: number;
  private readonly fuse: Fuse<IndexedField>;
  private readonly hasFields: boolean;

  public constructor(documents: readonly SnoogleSearchDocument<T>[], options: SnoogleSearchOptions = {}) {
    this.documents = documents;
    this.weights = {
      primary: options.fieldWeights?.primary ?? FIELD_WEIGHTS.primary,
      secondary: options.fieldWeights?.secondary ?? FIELD_WEIGHTS.secondary,
      tertiary: options.fieldWeights?.tertiary ?? FIELD_WEIGHTS.tertiary,
    };
    this.minTokenScore = options.minTokenScore ?? 0.2;
    const indexedFields: IndexedField[] = [];
    documents.forEach((document, documentIndex) => {
      (Object.keys(FIELD_WEIGHTS) as SnoogleFieldTier[]).forEach((tier) => {
        for (const rawText of document.fields[tier]) {
          const text = rawText.trim();
          if (text) indexedFields.push({ documentIndex, text, tier });
        }
      });
    });
    this.hasFields = indexedFields.length > 0;
    this.fuse = new Fuse(indexedFields, {
      keys: ['text'], includeScore: true, ignoreLocation: true,
      threshold: options.fuseThreshold ?? 0.72, minMatchCharLength: 1, shouldSort: false,
    });
  }

  public search(query: string): SnoogleRankedResult<T>[] {
    const tokens = tokenizeSnoogleQuery(query);
    if (tokens.length === 0) {
      return [...this.documents].sort((a, b) => a.id.localeCompare(b.id))
        .map((document) => ({ value: document.value, score: 0, tokenScores: [] }));
    }
    if (!this.hasFields) return [];
    const scoresByDocument = this.documents.map(() => [] as number[]);
    for (const token of tokens) {
      const probes = expandSnoogleToken(token);
      if (probes.length === 0) continue;
      const probeScores = probes.map((probe) => {
        const needle = probe.text.toLowerCase();
        const best = new Array<number>(this.documents.length).fill(0);
        for (const result of this.fuse.search(probe.text) as FuseResult<IndexedField>[]) {
          if (!probe.tiers.includes(result.item.tier)) continue;
          const score = Math.max(0, 1 - (result.score ?? 1)) *
            this.weights[result.item.tier] * exactnessFactor(needle, result.item.text);
          best[result.item.documentIndex] = Math.max(best[result.item.documentIndex], score);
        }
        return best;
      });
      for (let index = 0; index < this.documents.length; index += 1) {
        const parts = probeScores.map((scores) => scores[index]);
        scoresByDocument[index].push(parts.some((score) => score <= 0) ? 0 :
          Math.exp(parts.reduce((sum, score) => sum + Math.log(score), 0) / parts.length));
      }
    }
    const ranked: Array<SnoogleRankedResult<T> & { id: string }> = [];
    this.documents.forEach((document, index) => {
      const tokenScores = scoresByDocument[index];
      if (tokenScores.length !== tokens.length || tokenScores.some((score) => score < this.minTokenScore)) return;
      const score = Math.exp(tokenScores.reduce((sum, value) => sum + Math.log(value), 0) / tokenScores.length);
      ranked.push({ id: document.id, value: document.value, score, tokenScores });
    });
    ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return ranked.map(({ id: _id, ...result }) => result);
  }
}

export function splitSnoogleNamespace(id: string): { tail: string; middle: string[] } {
  const segments = id.split('.').map((segment) => segment.trim()).filter(Boolean);
  return { tail: segments.at(-1) ?? id, middle: segments.slice(0, -1) };
}

export function createSnoogleSearchDocument<T>({ id, value, labels = [] }: {
  id: string; value: T; labels?: readonly string[];
}): SnoogleSearchDocument<T> {
  const namespace = splitSnoogleNamespace(id);
  return { id, value, fields: { primary: [namespace.tail], secondary: labels, tertiary: namespace.middle } };
}

export function rankSnoogleDocuments<T>(
  query: string, documents: readonly SnoogleSearchDocument<T>[], options: SnoogleSearchOptions = {},
): SnoogleRankedResult<T>[] {
  return new SnoogleSearchIndex(documents, options).search(query);
}

export function rankSnooglCandidates<T extends SnoogleSearchCandidate>(
  query: string, candidates: readonly T[], options: SnoogleSearchOptions = {},
): T[] {
  const unique = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
  return rankSnoogleDocuments(query, unique.map((candidate) => createSnoogleSearchDocument({
    id: candidate.id, value: candidate, labels: candidate.labels,
  })), options).map((result) => result.value);
}

/** Query the live workspace with the exact shared SNoogL field tiers and ranker. */
export async function querySnoogl(
  workspaceRoot: string, mode: SnoogleMode, query: string,
): Promise<SnoogleQueryResponse> {
  if (mode === 'entry') {
    const entries = await readEntries(workspaceRoot);
    const hits: SnoogleEntryHit[] = entries.map((entry) => ({
      kind: 'entry', id: entry.id, title: localizedText(entry.title), entryKind: entry.kind ?? null, score: 0,
    }));
    const results = rankSnoogleDocuments(query.trim().toLowerCase(), hits.map((hit) =>
      createSnoogleSearchDocument({ id: hit.id, value: hit, labels: hit.title ? [hit.title] : [] })))
      .map((result) => ({ ...result.value, score: result.score }));
    return { schemaVersion: 1, mode, query, results };
  }

  function localizedText(value: import('./snl-doc-schema.ts').LocalizedString): string {
    if (typeof value === 'string') return value;
    return value.values[value.default_language] ?? value.values.en ?? Object.values(value.values)[0] ?? '';
  }

  const [config, packages] = await Promise.all([readConfig(workspaceRoot), readAllMacroPackages(workspaceRoot)]);
  const active = config.active_macro_packages === undefined ? null : new Set(config.active_macro_packages);
  const hits: SnoogleMacroHit[] = [];
  for (const packageId of Object.keys(packages).sort((a, b) => a.localeCompare(b))) {
    if (active && !active.has(packageId)) continue;
    const pkg = packages[packageId];
    for (const [id, macro] of Object.entries(pkg.macros)) {
      hits.push({
        kind: 'macro', id, packageId, packageName: pkg.name,
        macroKind: typeof macro.kind === 'string' && macro.kind ? macro.kind : null,
        tags: Array.isArray(macro.tags) ? [...macro.tags] : [],
        sourceEntries: Array.isArray(macro.source?.entries) ? [...macro.source.entries] : [], score: 0,
      });
    }
  }
  const results = rankSnoogleDocuments(query.trim().toLowerCase(), hits.map((hit) =>
    createSnoogleSearchDocument({ id: hit.id, value: hit, labels: hit.tags })))
    .map((result) => ({ ...result.value, score: result.score }));
  return { schemaVersion: 1, mode, query, results };
}
