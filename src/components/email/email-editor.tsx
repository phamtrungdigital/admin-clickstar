"use client";

/**
 * Phase C-MVP + C5: TipTap rich-text editor cho email body.
 * Output HTML chuẩn email — dùng được trực tiếp với Resend.
 *
 * Toolbar đầy đủ: heading / bold / italic / underline / list / align / link /
 * image (base64 inline) / color (text + highlight) / table / emoji /
 * special chars / preview / clear format / undo-redo.
 *
 * Image MVP dùng base64 — KHÔNG cần Storage setup.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
  Eye,
  RemoveFormatting,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
  Pilcrow,
  Palette,
  Highlighter,
  Table as TableIcon,
  Smile,
  Omega,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker, EmojiPicker, PickerDropdown, SpecialCharsPicker } from "./editor-pickers";

interface EmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function EmailEditor({ value, onChange, placeholder = "Nhập nội dung email..." }: EmailEditorProps) {
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:no-underline",
          rel: "noopener noreferrer",
        },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "email-table" } }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[480px] w-full bg-white px-5 py-4 text-sm leading-relaxed text-slate-900 focus:outline-none prose prose-sm max-w-none prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-blue-600 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:bg-slate-100 prose-th:p-2 prose-td:border prose-td:border-slate-200 prose-td:p-2",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync khi value đổi từ ngoài (vd load template lần đầu)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value && !editor.isFocused) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  const promptLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("URL:", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editor) return;
      const file = e.target.files?.[0];
      if (!file) return;
      const MAX = 1024 * 1024;
      if (file.size > MAX) {
        if (!confirm(`Ảnh ${(file.size / 1024 / 1024).toFixed(1)}MB lớn — email có thể vào spam. Tiếp tục?`)) {
          e.target.value = "";
          return;
        }
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [editor],
  );

  if (!editor) return <div className="h-[520px] w-full animate-pulse rounded-md bg-slate-100" />;

  return (
    <div className="overflow-visible rounded-xl border border-slate-200 bg-white">
      {!previewMode && (
        <Toolbar
          editor={editor}
          onLink={promptLink}
          onImage={insertImage}
          onPreview={() => setPreviewMode(true)}
        />
      )}
      {previewMode ? (
        <div className="bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-500 text-xs">↓ Preview HTML cuối</span>
            <button
              onClick={() => setPreviewMode(false)}
              className="text-blue-600 hover:text-blue-600-700 text-xs font-medium"
            >
              ← Quay lại sửa
            </button>
          </div>
          <div
            className="bg-white min-h-[480px] rounded-md border border-slate-200 p-5 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

interface ToolbarProps {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  onLink: () => void;
  onImage: () => void;
  onPreview: () => void;
}

function Toolbar({ editor, onLink, onImage, onPreview }: ToolbarProps) {
  const [openPicker, setOpenPicker] = useState<null | "color" | "highlight" | "emoji" | "chars" | "table">(null);
  const colorBtn = useRef<HTMLButtonElement>(null);
  const highlightBtn = useRef<HTMLButtonElement>(null);
  const emojiBtn = useRef<HTMLButtonElement>(null);
  const charsBtn = useRef<HTMLButtonElement>(null);
  const tableBtn = useRef<HTMLButtonElement>(null);

  return (
    <div className="border-slate-200 bg-slate-50 relative flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác (Ctrl+Z)">
        <Undo className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại (Ctrl+Y)">
        <Redo className="h-4 w-4" />
      </Btn>

      <Sep />

      <Btn active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} title="Đoạn văn">
        <Pilcrow className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Tiêu đề 1">
        <Heading1 className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Tiêu đề 2">
        <Heading2 className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Tiêu đề 3">
        <Heading3 className="h-4 w-4" />
      </Btn>

      <Sep />

      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="In đậm (Ctrl+B)">
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="In nghiêng (Ctrl+I)">
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Gạch chân (Ctrl+U)">
        <UnderlineIcon className="h-4 w-4" />
      </Btn>

      {/* Color text */}
      <div className="relative">
        <Btn
          ref={colorBtn}
          onClick={() => setOpenPicker(openPicker === "color" ? null : "color")}
          title="Màu chữ"
        >
          <Palette className="h-4 w-4" />
        </Btn>
        <PickerDropdown
          open={openPicker === "color"}
          onClose={() => setOpenPicker(null)}
          anchorRef={colorBtn}
          width={240}
        >
          <ColorPicker
            label="Màu chữ"
            onSelect={(hex) => {
              if (hex === null) editor.chain().focus().unsetColor().run();
              else editor.chain().focus().setColor(hex).run();
              setOpenPicker(null);
            }}
          />
        </PickerDropdown>
      </div>

      {/* Highlight bg */}
      <div className="relative">
        <Btn
          ref={highlightBtn}
          active={editor.isActive("highlight")}
          onClick={() => setOpenPicker(openPicker === "highlight" ? null : "highlight")}
          title="Tô nền chữ"
        >
          <Highlighter className="h-4 w-4" />
        </Btn>
        <PickerDropdown
          open={openPicker === "highlight"}
          onClose={() => setOpenPicker(null)}
          anchorRef={highlightBtn}
          width={240}
        >
          <ColorPicker
            label="Tô nền (highlight)"
            onSelect={(hex) => {
              if (hex === null) editor.chain().focus().unsetHighlight().run();
              else editor.chain().focus().setHighlight({ color: hex }).run();
              setOpenPicker(null);
            }}
          />
        </PickerDropdown>
      </div>

      <Sep />

      <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Căn trái">
        <AlignLeft className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Căn giữa">
        <AlignCenter className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Căn phải">
        <AlignRight className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Căn đều">
        <AlignJustify className="h-4 w-4" />
      </Btn>

      <Sep />

      <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Danh sách chấm">
        <List className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Danh sách số">
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Trích dẫn">
        <Quote className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
        <Code className="h-4 w-4" />
      </Btn>

      <Sep />

      {/* Table */}
      <div className="relative">
        <Btn
          ref={tableBtn}
          active={editor.isActive("table")}
          onClick={() => setOpenPicker(openPicker === "table" ? null : "table")}
          title="Bảng"
        >
          <TableIcon className="h-4 w-4" />
        </Btn>
        <PickerDropdown
          open={openPicker === "table"}
          onClose={() => setOpenPicker(null)}
          anchorRef={tableBtn}
          width={220}
        >
          <TableMenu editor={editor} onClose={() => setOpenPicker(null)} />
        </PickerDropdown>
      </div>

      <Btn active={editor.isActive("link")} onClick={onLink} title="Chèn link">
        <LinkIcon className="h-4 w-4" />
      </Btn>
      <Btn onClick={onImage} title="Chèn ảnh (≤1MB)">
        <ImageIcon className="h-4 w-4" />
      </Btn>

      {/* Emoji */}
      <div className="relative">
        <Btn
          ref={emojiBtn}
          onClick={() => setOpenPicker(openPicker === "emoji" ? null : "emoji")}
          title="Emoji"
        >
          <Smile className="h-4 w-4" />
        </Btn>
        <PickerDropdown
          open={openPicker === "emoji"}
          onClose={() => setOpenPicker(null)}
          anchorRef={emojiBtn}
          width={300}
        >
          <EmojiPicker
            onSelect={(e) => {
              editor.chain().focus().insertContent(e).run();
              setOpenPicker(null);
            }}
          />
        </PickerDropdown>
      </div>

      {/* Special chars */}
      <div className="relative">
        <Btn
          ref={charsBtn}
          onClick={() => setOpenPicker(openPicker === "chars" ? null : "chars")}
          title="Ký tự đặc biệt"
        >
          <Omega className="h-4 w-4" />
        </Btn>
        <PickerDropdown
          open={openPicker === "chars"}
          onClose={() => setOpenPicker(null)}
          anchorRef={charsBtn}
          width={300}
        >
          <SpecialCharsPicker
            onSelect={(c) => {
              editor.chain().focus().insertContent(c).run();
              setOpenPicker(null);
            }}
          />
        </PickerDropdown>
      </div>

      <Sep />

      <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Xoá định dạng">
        <RemoveFormatting className="h-4 w-4" />
      </Btn>
      <Btn onClick={onPreview} title="Xem preview">
        <Eye className="h-4 w-4" />
      </Btn>
    </div>
  );
}

function TableMenu({
  editor,
  onClose,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  onClose: () => void;
}) {
  const inTable = editor.isActive("table");

  return (
    <div className="space-y-1.5">
      <p className="text-slate-500 mb-1 text-[11px] font-medium uppercase tracking-wide">Bảng</p>
      {!inTable ? (
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            onClose();
          }}
          className="hover:bg-slate-100 text-slate-900 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Chèn bảng 3×3 (có header)
        </button>
      ) : (
        <>
          <MenuRow icon={<Plus className="h-3.5 w-3.5" />} label="Thêm cột trái" onClick={() => editor.chain().focus().addColumnBefore().run()} />
          <MenuRow icon={<Plus className="h-3.5 w-3.5" />} label="Thêm cột phải" onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <MenuRow icon={<Plus className="h-3.5 w-3.5" />} label="Thêm hàng trên" onClick={() => editor.chain().focus().addRowBefore().run()} />
          <MenuRow icon={<Plus className="h-3.5 w-3.5" />} label="Thêm hàng dưới" onClick={() => editor.chain().focus().addRowAfter().run()} />
          <hr className="border-slate-200/40" />
          <MenuRow icon={<Minus className="h-3.5 w-3.5" />} label="Xoá cột" onClick={() => editor.chain().focus().deleteColumn().run()} />
          <MenuRow icon={<Minus className="h-3.5 w-3.5" />} label="Xoá hàng" onClick={() => editor.chain().focus().deleteRow().run()} />
          <MenuRow icon={<Minus className="h-3.5 w-3.5" />} label="Xoá toàn bảng" danger onClick={() => editor.chain().focus().deleteTable().run()} />
        </>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs",
        danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-900 hover:bg-slate-100",
      )}
    >
      {icon} {label}
    </button>
  );
}

const Btn = ({
  ref,
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    className={cn(
      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
      active
        ? "bg-blue-600/15 text-blue-600"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent",
    )}
  >
    {children}
  </button>
);

function Sep() {
  return <span className="bg-border/60 mx-1 h-5 w-px" aria-hidden="true" />;
}
