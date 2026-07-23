import type { CollectionEntry } from 'astro:content';
import { normalizeTitle } from './titleKey';

type Note = CollectionEntry<'notes'>;

const WIKILINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Maps every note's title and aliases (normalized) to the note itself. */
export function buildTitleIndex(notes: Note[]): Map<string, Note> {
  const index = new Map<string, Note>();

  for (const note of notes) {
    for (const key of [note.data.title, ...note.data.aliases]) {
      const normalized = normalizeTitle(key);
      if (!index.has(normalized)) index.set(normalized, note);
    }
  }

  return index;
}

export function resolveWikilink(index: Map<string, Note>, target: string): Note | undefined {
  return index.get(normalizeTitle(target));
}

function extractWikilinkTargets(raw: string): string[] {
  return [...raw.matchAll(WIKILINK_PATTERN)].map((match) => match[1].trim());
}

export interface LinkGraph {
  /** Notes each note links out to, resolved from its own [[wikilinks]]. */
  outbound: Map<string, Note[]>;
  /** Notes that link to each note — the reverse of outbound. */
  backlinks: Map<string, Note[]>;
}

function addUnique(map: Map<string, Note[]>, key: string, note: Note): void {
  const existing = map.get(key) ?? [];
  if (existing.some((n) => n.id === note.id)) return;
  map.set(key, [...existing, note]);
}

/** Scans every note's raw body for [[wikilinks]] once and builds both directions of the link graph. */
export function computeLinkGraph(notes: Note[]): LinkGraph {
  const index = buildTitleIndex(notes);
  const outbound = new Map<string, Note[]>();
  const backlinks = new Map<string, Note[]>();

  for (const note of notes) {
    const targets = extractWikilinkTargets(note.body ?? '');

    for (const target of targets) {
      const resolved = resolveWikilink(index, target);
      if (!resolved || resolved.id === note.id) continue;

      addUnique(outbound, note.id, resolved);
      addUnique(backlinks, resolved.id, note);
    }
  }

  return { outbound, backlinks };
}
