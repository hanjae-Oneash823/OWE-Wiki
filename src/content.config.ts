import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/notes' }),
  schema: z.object({
    // Stable identifier for bookmarks/comments - set once, never changed even if the slug is renamed.
    noteId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    // Domains are admin-editable (see the `domains` table) rather than a fixed set, so
    // this isn't a z.enum — validity is checked at the API boundary instead.
    domain: z.string(),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    // Former titles this note was published under — [[Old Title]] wikilinks elsewhere keep resolving after a rename.
    aliases: z.array(z.string()).default([]),
    publishedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { notes };
export { getNoteSlug } from './lib/noteSlug';
