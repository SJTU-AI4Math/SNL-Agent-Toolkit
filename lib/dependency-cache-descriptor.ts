// Input projection and validator from Extension 76acedbc dependencyCache.ts.
import { isAutomaticDependency, type RelationshipData, type DependencyEntry as EntryData, type DependencyMacro as MacroPackageEntry } from './relationship-generation.ts';
import type { CacheDescriptor } from './dependency-cache-storage.ts';
export interface DependencySnapshot {
  entries: readonly Pick<EntryData, 'id' | 'content'>[];
  macros: Readonly<Record<string, Pick<MacroPackageEntry, 'source'>>>;
  relationships: readonly RelationshipData[];
}
const compareId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Cache only generated rows; never cache or publish a second Authoring pool. */
export function dependencyCacheDescriptor(snapshot: DependencySnapshot): CacheDescriptor<RelationshipData[]> {
  // Detach a complete semantic global snapshot. No Uri, Set, Map or UI scope
  // enters the cache hash. Authored rows affect identity allocation/atomicity.
  const input = JSON.parse(JSON.stringify({
    entries: snapshot.entries.map(e => ({ id: e.id, content: { snl: e.content?.snl ?? '' } })).sort(compareId),
    macros: Object.fromEntries(Object.keys(snapshot.macros).sort().map(name => [name, { source: { entries: snapshot.macros[name].source?.entries ?? [] } }])),
    relationships: [...snapshot.relationships].sort(compareId)
  })) as DependencySnapshot;
  const pool = new Set(input.entries.map(e => e.id));
  const reserved = new Set(input.relationships.filter(r => !isAutomaticDependency(r)).map(r => r.id));
  return {
    id: 'dependencies', version: '1', input,
    validate(value): value is RelationshipData[] {
      if (!Array.isArray(value)) return false;
      const ids = new Set<string>(); const pairs = new Set<string>();
      return value.every(r => {
        if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || r.id !== r.id.trim() ||
            !isAutomaticDependency(r) || !pool.has(r.from) || !pool.has(r.to) || r.from === r.to ||
            reserved.has(r.id) || ids.has(r.id) || typeof r.metadata?.isAtomic !== 'boolean' ||
            !Array.isArray(r.metadata.macros) || !r.metadata.macros.every((m: unknown) => typeof m === 'string')) return false;
        const pair = JSON.stringify([r.from, r.to]);
        if (pairs.has(pair)) return false;
        ids.add(r.id); pairs.add(pair); return true;
      });
    },
  };
}
