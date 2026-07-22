import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { getNoteSlug } from './noteSlug';
import { normalizeTitle } from './titleKey';

// Reads note frontmatter straight off disk rather than through `astro:content`: this
// module is called from a remark plugin during the MDX compile pipeline, and that
// pipeline is itself triggered by rendering content-collection entries — going back
// through `astro:content` there would re-enter Vite's module runner mid-transform.
const NOTES_DIR = path.resolve(process.cwd(), 'src/content/notes');
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

export interface NoteIndexEntry {
  title: string;
  domain: string;
  slug: string;
}

interface RawFrontmatter {
  title?: string;
  domain?: string;
  aliases?: string[];
}

async function collectMdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry): Promise<string[]> => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectMdxFiles(fullPath);
      return Promise.resolve(entry.isFile() && entry.name.endsWith('.mdx') ? [fullPath] : []);
    }),
  );
  return nested.flat();
}

function toNoteId(filePath: string): string {
  return path.relative(NOTES_DIR, filePath).replace(/\.mdx$/, '').split(path.sep).join('/');
}

/** Builds a title/alias → note lookup for resolving [[wikilinks]] at MDX compile time. */
export async function buildNoteIndex(): Promise<Map<string, NoteIndexEntry>> {
  const files = await collectMdxFiles(NOTES_DIR);
  const index = new Map<string, NoteIndexEntry>();

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf-8');
    const match = raw.match(FRONTMATTER_PATTERN);
    if (!match) continue;

    const frontmatter = parseYaml(match[1]) as RawFrontmatter;
    if (!frontmatter.title || !frontmatter.domain) continue;

    const domain = frontmatter.domain;
    const entry: NoteIndexEntry = { title: frontmatter.title, domain, slug: getNoteSlug(toNoteId(filePath), domain) };

    for (const key of [frontmatter.title, ...(frontmatter.aliases ?? [])]) {
      const normalized = normalizeTitle(key);
      if (!index.has(normalized)) index.set(normalized, entry);
    }
  }

  return index;
}
