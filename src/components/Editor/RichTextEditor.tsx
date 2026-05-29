import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Undo, 
  Redo 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  findPendingFieldMarkers,
  highlightPendingFieldsInElement,
  PENDING_FIELD_HIGHLIGHT_CLASS,
  PENDING_FIELD_HIGHLIGHT_STYLE,
} from '@/lib/pendingFieldHighlight';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  highlightPendingFields?: boolean;
  /** Content rendered on the left side of the toolbar (e.g. back button, template name) */
  toolbarLeft?: ReactNode;
  /** Content rendered on the right side of the toolbar (e.g. save, verify buttons) */
  toolbarRight?: ReactNode;
}

function ToolbarBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground',
        active && 'bg-primary/10 text-primary'
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="w-px h-4 bg-border mx-0.5" />;

const PendingFieldHighlight = Extension.create<{ enabled: boolean }>({
  name: 'pendingFieldHighlight',

  addOptions() {
    return {
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pendingFieldHighlight'),
        props: {
          decorations: (state) => {
            if (!this.options.enabled) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            state.doc.descendants((node, position) => {
              if (!node.isText || !node.text) return;

              findPendingFieldMarkers(node.text).forEach((marker) => {
                decorations.push(
                  Decoration.inline(position + marker.start, position + marker.end, {
                    class: PENDING_FIELD_HIGHLIGHT_CLASS,
                    style: PENDING_FIELD_HIGHLIGHT_STYLE,
                  }),
                );
              });
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export default function RichTextEditor({
  content,
  onChange,
  placeholder,
  highlightPendingFields = false,
  toolbarLeft,
  toolbarRight,
}: RichTextEditorProps) {
  const isSyncingExternally = useRef(false);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Comece a digitar...' }),
      PendingFieldHighlight.configure({ enabled: highlightPendingFields }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (isSyncingExternally.current) {
        isSyncingExternally.current = false;
        return;
      }
      if (editor.isDestroyed) return;
      onChange(editor.getHTML());
    },
  }, [highlightPendingFields]);

  const applyPendingFieldDomHighlight = useCallback(() => {
    if (!highlightPendingFields) return;
    window.requestAnimationFrame(() => {
      if (!editor || editor.isDestroyed) return;
      highlightPendingFieldsInElement(editorShellRef.current?.querySelector('.tiptap') || null);
    });
  }, [editor, highlightPendingFields]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (content !== current) {
      isSyncingExternally.current = true;
      editor.commands.setContent(content || '<p></p>', false);
    }
    applyPendingFieldDomHighlight();
  }, [applyPendingFieldDomHighlight, content, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !highlightPendingFields) return;
    applyPendingFieldDomHighlight();
    editor.on('update', applyPendingFieldDomHighlight);
    editor.on('selectionUpdate', applyPendingFieldDomHighlight);
    return () => {
      if (editor.isDestroyed) return;
      editor.off('update', applyPendingFieldDomHighlight);
      editor.off('selectionUpdate', applyPendingFieldDomHighlight);
    };
  }, [applyPendingFieldDomHighlight, editor, highlightPendingFields]);

  if (!editor) return null;

  return (
    <div ref={editorShellRef} className="flex flex-col w-full">
      {/* Unified Toolbar Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        {/* Left slot */}
        {toolbarLeft && (
          <>
            {toolbarLeft}
            <Sep />
          </>
        )}

        {/* Formatting tools */}
        <div className="flex items-center gap-0.5">
          <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="w-3.5 h-3.5" />
          </ToolbarBtn>
        </div>

        {/* Right slot (pushed to far right) */}
        {toolbarRight && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {toolbarRight}
          </div>
        )}
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none flex-1 px-6 py-5 focus:outline-none min-h-[380px] [&_.tiptap]:outline-none [&_.tiptap]:min-h-[380px]"
      />
    </div>
  );
}
