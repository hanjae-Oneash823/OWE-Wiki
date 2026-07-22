import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import type { BlockNoteEditor } from '@blocknote/core';
import { getDefaultReactSlashMenuItems } from '@blocknote/react';
import type { DefaultReactSuggestionItem } from '@blocknote/react';
import { calloutBlock } from './calloutBlock';

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: calloutBlock(),
  },
});

export type WikiEditor = BlockNoteEditor<typeof editorSchema.blockSchema, typeof editorSchema.inlineContentSchema, typeof editorSchema.styleSchema>;

export function getSlashMenuItems(editor: WikiEditor, query: string): DefaultReactSuggestionItem[] {
  const items: DefaultReactSuggestionItem[] = [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: 'Callout',
      subtext: 'Highlight important information',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, { type: 'callout' });
      },
      aliases: ['callout', 'note', 'alert', 'tip'],
      group: 'Basic blocks',
    },
  ];
  return filterSuggestionItems(items, query);
}
