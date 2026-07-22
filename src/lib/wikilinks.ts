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

/** Scans every note's raw body for [[wikilinks]] and returns, per note, which other notes link to it. */
export function computeBacklinks(notes: Note[]): Map<string, Note[]> {
  const index = buildTitleIndex(notes);
  const backlinks = new Map<string, Note[]>();

  for (const note of notes) {
    const targets = extractWikilinkTargets(note.body ?? '');
    const linkedNoteIds = new Set<string>();

    for (const target of targets) {
      const resolved = resolveWikilink(index, target);
      if (!resolved || resolved.id === note.id || linkedNoteIds.has(resolved.id)) continue;

      linkedNoteIds.add(resolved.id);
      backlinks.set(resolved.id, [...(backlinks.get(resolved.id) ?? []), note]);
    }
  }

  return backlinks;
}
