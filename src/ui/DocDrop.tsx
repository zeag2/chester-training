import { useRef, useState, type DragEvent } from 'react';

/** A file dropped onto a screen, numbered so dropping the same file twice still counts as a new drop. */
export type Dropped = { file: File; n: number };

/** The file types the document reader takes (the same as the "Add a document" picker's `accept`). */
export const isDocFile = (f: File) => f.type.startsWith('image/') || f.type === 'application/pdf';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** Drag-and-drop a document onto a whole screen (desktop plan step 5: Health and All documents). Spread `bind` on the
    screen's root; `dragging` is true while a file is held over it (show <DropNote />). Dragged text or links are
    ignored. Only event handlers are added, so the screen's markup is unchanged until something is dragged over it. */
export function useDocDrop(onDrop: (d: Dropped) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0), n = useRef(0);
  const bind = {
    onDragEnter: (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setDragging(true); },
    onDragOver: (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; },
    onDragLeave: (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth.current = 0; setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onDrop({ file, n: ++n.current });
    },
  };
  return { dragging, bind };
}

/** The note shown over the screen while a file is dragged over it. */
export function DropNote() {
  return <div className="dropnote" aria-hidden="true"><div className="dropnote-in"><b>Drop to add a document</b>
    <span className="s">A photo or a PDF. It’s read here, and you check what it found before anything is saved.</span></div></div>;
}
