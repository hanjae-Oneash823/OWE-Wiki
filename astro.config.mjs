// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import pagefind from 'astro-pagefind';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import { remarkWikilinks } from './src/lib/remarkWikilinks.ts';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [mdx(), pagefind(), react()],
  markdown: {
    remarkPlugins: [remarkMath, remarkWikilinks],
    rehypePlugins: [rehypeKatex],
  },
});
