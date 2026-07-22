/** Strips the leading `domain/` segment the glob loader adds to `note.id`. */
export function getNoteSlug(noteId: string, domain: string): string {
  return noteId.startsWith(`${domain}/`) ? noteId.slice(domain.length + 1) : noteId;
}
