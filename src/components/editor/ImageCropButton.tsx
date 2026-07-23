import { useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { blockHasType } from '@blocknote/core';
import { useBlockNoteEditor, useComponentsContext, useEditorState } from '@blocknote/react';
import { editorSchema } from './schema';
import { getCroppedImageBlob } from '../../lib/cropImage';
import { uploadImageBlob } from '../../lib/uploadImage';
import './ImageCropButton.css';

const ASPECT_PRESETS = [
  { label: 'Original', value: 'original' as const },
  { label: 'Square', value: 1 },
  { label: 'Wide', value: 16 / 9 },
];

const CropIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </svg>
);

export function ImageCropButton() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor<
    typeof editorSchema.blockSchema,
    typeof editorSchema.inlineContentSchema,
    typeof editorSchema.styleSchema
  >();

  const block = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor.isEditable) return undefined;

      const selectedBlocks = editor.getSelection()?.blocks || [editor.getTextCursorPosition().block];
      if (selectedBlocks.length !== 1) return undefined;

      const candidate = selectedBlocks[0];
      if (candidate.type !== 'image' || !blockHasType(candidate, editor, candidate.type, { url: 'string' })) {
        return undefined;
      }

      return candidate;
    },
  });

  const [isOpen, setIsOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [naturalAspect, setNaturalAspect] = useState(1);
  const [aspect, setAspect] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (block === undefined) return null;

  function openModal() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError('');
    setIsOpen(true);
  }

  function selectAspect(value: 'original' | number) {
    setAspect(value === 'original' ? naturalAspect : value);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function confirmCrop() {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    setError('');
    try {
      const blob = await getCroppedImageBlob(block!.props.url, croppedAreaPixels);
      const publicUrl = await uploadImageBlob(blob);
      editor.updateBlock(block!, { props: { url: publicUrl } });
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to crop image');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Components.FormattingToolbar.Button
        className="bn-button"
        mainTooltip="Crop image"
        label="Crop image"
        icon={<CropIcon />}
        onClick={openModal}
      />
      {isOpen && (
        <div className="image-crop-overlay">
          <div className="image-crop-modal">
            <div className="image-crop-area">
              <Cropper
                image={block.props.url}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
                onMediaLoaded={(size) => {
                  const ratio = size.width / size.height;
                  setNaturalAspect(ratio);
                  setAspect(ratio);
                }}
              />
            </div>
            <div className="image-crop-controls">
              <div className="image-crop-presets">
                {ASPECT_PRESETS.map((preset) => (
                  <button key={preset.label} type="button" onClick={() => selectAspect(preset.value)}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
              {error && <p className="image-crop-error">{error}</p>}
              <div className="image-crop-actions">
                <button type="button" onClick={() => setIsOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={confirmCrop} disabled={isSaving || !croppedAreaPixels}>
                  {isSaving ? 'Saving…' : 'Apply crop'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
