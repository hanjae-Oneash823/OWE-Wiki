import { useEffect, useMemo, useRef, useState } from 'react';
import { BlockNoteView, darkDefaultTheme, lightDefaultTheme } from '@blocknote/mantine';
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { editorSchema, getSlashMenuItems } from './editor/schema';
import { createSupabaseBrowserClient } from '../lib/supabase/browser';
import './DraftEditor.css';

interface DraftEditorProps {
  draftId: string;
  domains: readonly string[];
}

interface DraftRecord {
  title: string;
  domain: string;
  content: string | null;
}

type LoadState = 'loading' | 'ready' | 'error';

const editorTheme = { light: lightDefaultTheme, dark: darkDefaultTheme };

export default function DraftEditor({ draftId, domains }: DraftEditorProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<string>(domains[0]);
  const [saveStatus, setSaveStatus] = useState('');
  const userIdRef = useRef<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const editor = useCreateBlockNote({
    schema: editorSchema,
    uploadFile: async (file: File) => {
      const userId = userIdRef.current;
      if (!userId) throw new Error('Not signed in');

      const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from('draft-images').upload(path, file);
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from('draft-images').getPublicUrl(path);
      return data.publicUrl;
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      userIdRef.current = userData.user?.id ?? null;

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

      const blocks = editor.tryParseMarkdownToBlocks(draft.content ?? '');
      editor.replaceBlocks(editor.document, blocks);
      setLoadState('ready');
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [draftId, editor, supabase]);

  async function save(extraFields: Record<string, unknown> = {}) {
    setSaveStatus('Saving…');
    try {
      const content = editor.blocksToMarkdownLossy();
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, domain, content, ...extraFields }),
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
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          required
          maxLength={200}
        />
        <div className="editor-row">
          <select value={domain} onChange={(event) => setDomain(event.target.value)} required>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="block-editor-wrapper">
          <BlockNoteView editor={editor} slashMenu={false} theme={editorTheme}>
            <SuggestionMenuController triggerCharacter="/" getItems={async (query) => getSlashMenuItems(editor, query)} />
          </BlockNoteView>
        </div>
        <div className="editor-actions">
          <button type="button" onClick={() => save()}>
            Save
          </button>
          <button type="button" onClick={() => save({ status: 'pending_publish' })}>
            Submit for review
          </button>
        </div>
        <p className="form-status">{saveStatus}</p>
      </div>
    </div>
  );
}
