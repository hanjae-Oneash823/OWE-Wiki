import { findAndReplace } from 'mdast-util-find-and-replace';
import type { Link, Root } from 'mdast';
import { buildNoteIndex } from './noteIndex';
import { normalizeTitle } from './titleKey';

const WIKILINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

function buildLinkNode(url: string, label: string, className: string, title?: string): Link {
  return {
    type: 'link',
    url,
    data: { hProperties: { className: [className], ...(title ? { title } : {}) } },
    children: [{ type: 'text', value: label }],
  };
}

/** Resolves [[Title]] / [[Title|Display]] wikilinks against every note's title + aliases. */
export function remarkWikilinks() {
  return async (tree: Root) => {
    const index = await buildNoteIndex();

    findAndReplace(tree, [
      [
        WIKILINK_PATTERN,
        (_match: string, target: string, display: string | undefined) => {
          const label = (display ?? target).trim();
          const resolved = index.get(normalizeTitle(target));

          if (!resolved) {
            return buildLinkNode('#', label, 'wikilink-broken', 'No article found');
          }

          const href = `/notes/${resolved.domain}/${resolved.slug}`;
          return buildLinkNode(href, label, 'wikilink');
        },
      ],
    ]);
  };
}
