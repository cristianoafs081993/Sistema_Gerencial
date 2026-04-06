import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
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
import { useEffect, useRef, type ReactNode } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
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

export default function RichTextEditor({ content, onChange, placeholder, toolbarLeft, toolbarRight }: RichTextEditorProps) {
  const isSyncingExternally = useRef(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Comece a digitar...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (isSyncingExternally.current) {
        isSyncingExternally.current = false;
        return;
      }
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current) {
      isSyncingExternally.current = true;
      editor.commands.setContent(content || '<p></p>', false);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col w-full">
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
