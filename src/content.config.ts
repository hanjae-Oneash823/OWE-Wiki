import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const DOMAINS = ['coding', 'bioinformatics', 'biology', 'ml-dl-ai'] as const;

const notes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/notes' }),
  schema: z.object({
    // Stable identifier for bookmarks/comments - set once, never changed even if the slug is renamed.
    noteId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    domain: z.enum(DOMAINS),
    tags: z.array(z.string()).default([]),
    relatedNotes: z.array(z.string()).default([]),
    publishedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { notes };
export { DOMAINS };

/** Strips the leading `domain/` segment the glob loader adds to `note.id`. */
export function getNoteSlug(noteId: string, domain: string): string {
  return noteId.startsWith(`${domain}/`) ? noteId.slice(domain.length + 1) : noteId;
}
