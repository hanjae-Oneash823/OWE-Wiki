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
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    // Former titles this note was published under — [[Old Title]] wikilinks elsewhere keep resolving after a rename.
    aliases: z.array(z.string()).default([]),
    publishedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { notes };
export { DOMAINS };
export { getNoteSlug } from './lib/noteSlug';
