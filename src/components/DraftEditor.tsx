import { useEffect, useState } from 'react';
import { BlockNoteView, lightDefaultTheme } from '@blocknote/mantine';
import type { Theme } from '@blocknote/mantine';
import {
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { editorSchema, getSlashMenuItems } from './editor/schema';
import { compressImage } from '../lib/compressImage';
import { uploadImageBlob } from '../lib/uploadImage';
import { ImageCropButton } from './editor/ImageCropButton';
import './DraftEditor.css';

interface DraftEditorProps {
  draftId: string;
  domains: readonly string[];
}

interface DraftRecord {
  title: string;
  domain: string;
  content: string | null;
  content_json: unknown;
}

type LoadState = 'loading' | 'ready' | 'error';

const editorTheme: Theme = {
  ...lightDefaultTheme,
  colors: {
    ...lightDefaultTheme.colors,
    editor: { text: 'var(--color-fg)', background: 'var(--color-bg)' },
    menu: { text: 'var(--color-fg)', background: 'var(--color-bg)' },
    tooltip: { text: 'var(--color-fg)', background: 'var(--color-bg)' },
    hovered: { text: 'var(--color-fg)', background: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' },
    selected: { text: 'var(--color-bg)', background: 'var(--color-accent)' },
    disabled: { text: 'var(--color-muted)', background: 'transparent' },
    shadow: 'var(--color-border)',
    border: 'var(--color-border)',
    sideMenu: 'var(--color-muted)',
  },
  borderRadius: 0,
  fontFamily: 'var(--font-body)',
};

export default function DraftEditor({ draftId, domains }: DraftEditorProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<string>(domains[0]);
  const [saveStatus, setSaveStatus] = useState('');

  const editor = useCreateBlockNote({
    schema: editorSchema,
    uploadFile: async (file: File) => {
      const compressed = await compressImage(file);
      return uploadImageBlob(compressed);
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/drafts/${draftId}`);
      if (cancelled) return;

      if (!response.ok) {
        setErrorMessage("Draft not found, or you don't have access to it.");
        setLoadState('error');
        return;
      }

      const { draft } = (await response.json()) as { draft: DraftRecord };
      if (cancelled) return;

      setTitle(draft.title);
      setDomain(draft.domain);

      // Prefer the native block document: plain Markdown can't represent image
      // resize/alignment/crop, so `content` alone would reset them on every reload.
      const blocks = Array.isArray(draft.content_json)
        ? (draft.content_json as typeof editor.document)
        : editor.tryParseMarkdownToBlocks(draft.content ?? '');
      editor.replaceBlocks(editor.document, blocks);
      setLoadState('ready');
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [draftId, editor]);

  async function save(extraFields: Record<string, unknown> = {}) {
    setSaveStatus('Saving…');
    try {
      const content = editor.blocksToMarkdownLossy();
      const contentJson = editor.document;
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, domain, content, contentJson, ...extraFields }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to save');
      }
      setSaveStatus('Saved.');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Failed to save');
    }
  }

  if (loadState === 'error') {
    return <p className="gate-message">{errorMessage}</p>;
  }

  return (
    <div className="draft-editor">
      {loadState === 'loading' && <p className="gate-message">Loading…</p>}
      <div className="draft-editor-form" hidden={loadState !== 'ready'}>
        <div className="draft-toolbar">
          <select
            className="domain-picker"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            required
          >
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="draft-toolbar-actions">
            <span className="form-status">{saveStatus}</span>
            <button type="button" onClick={() => save()}>
              Save
            </button>
            <button type="button" className="primary" onClick={() => save({ status: 'pending_publish' })}>
              Submit for review
            </button>
          </div>
        </div>
        <input
          type="text"
          className="draft-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          required
          maxLength={200}
        />
        <div className="block-editor-wrapper">
          <BlockNoteView editor={editor} slashMenu={false} formattingToolbar={false} theme={editorTheme}>
            <SuggestionMenuController triggerCharacter="/" getItems={async (query) => getSlashMenuItems(editor, query)} />
            <FormattingToolbarController
              formattingToolbar={() => (
                <FormattingToolbar>
                  {[...getFormattingToolbarItems(), <ImageCropButton key="imageCropButton" />]}
                </FormattingToolbar>
              )}
            />
          </BlockNoteView>
        </div>
      </div>
    </div>
  );
}
