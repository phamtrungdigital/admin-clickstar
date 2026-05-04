"use client";

/**
 * Lightweight pickers cho EmailEditor — emoji, special chars, color.
 * Tự build thay vì pull lib `emoji-picker-react` (200KB+) cho MVP.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PickerProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
  width?: number;
}

export function PickerDropdown({ open, onClose, anchorRef, children, width = 280 }: PickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="bg-white absolute top-full left-0 z-30 mt-1 rounded-lg border border-slate-200 p-2 shadow-lg"
      style={{ width }}
    >
      {children}
    </div>
  );
}

const COMMON_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆",
  "😉", "😊", "🥰", "😍", "😘", "🤗", "🤩", "🤔",
  "👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "✌️",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "✅", "❌", "⚠️", "ℹ️", "💡", "🔥", "⭐", "🎉",
  "🎯", "🚀", "📌", "📍", "📅", "⏰", "📧", "📞",
  "🏫", "🎓", "📚", "✏️", "📝", "📊", "📈", "💼",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div>
      <p className="text-slate-500 mb-1.5 text-[11px] font-medium uppercase tracking-wide">Emoji</p>
      <div className="grid grid-cols-8 gap-0.5">
        {COMMON_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onSelect(e)}
            className="hover:bg-slate-100 flex h-8 w-8 items-center justify-center rounded text-lg"
            title={e}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

const SPECIAL_CHARS: Array<{ char: string; label: string }> = [
  { char: "©", label: "Copyright" },
  { char: "®", label: "Registered" },
  { char: "™", label: "Trademark" },
  { char: "§", label: "Section" },
  { char: "¶", label: "Paragraph" },
  { char: "•", label: "Bullet" },
  { char: "·", label: "Middle dot" },
  { char: "—", label: "Em dash" },
  { char: "–", label: "En dash" },
  { char: "…", label: "Ellipsis" },
  { char: "«", label: "Left guillemet" },
  { char: "»", label: "Right guillemet" },
  { char: "“", label: "Left double quote" },
  { char: "”", label: "Right double quote" },
  { char: "‘", label: "Left single quote" },
  { char: "’", label: "Right single quote" },
  { char: "→", label: "Right arrow" },
  { char: "←", label: "Left arrow" },
  { char: "↑", label: "Up arrow" },
  { char: "↓", label: "Down arrow" },
  { char: "⇒", label: "Right double arrow" },
  { char: "⇐", label: "Left double arrow" },
  { char: "✓", label: "Check" },
  { char: "✗", label: "Cross" },
  { char: "★", label: "Star filled" },
  { char: "☆", label: "Star outline" },
  { char: "♥", label: "Heart" },
  { char: "♦", label: "Diamond" },
  { char: "♠", label: "Spade" },
  { char: "♣", label: "Club" },
  { char: "°", label: "Degree" },
  { char: "±", label: "Plus minus" },
  { char: "×", label: "Multiply" },
  { char: "÷", label: "Divide" },
  { char: "≈", label: "Approximate" },
  { char: "≠", label: "Not equal" },
  { char: "≤", label: "Less or equal" },
  { char: "≥", label: "Greater or equal" },
  { char: "∞", label: "Infinity" },
  { char: "€", label: "Euro" },
  { char: "£", label: "Pound" },
  { char: "¥", label: "Yen" },
  { char: "₫", label: "Vietnam Dong" },
  { char: "%", label: "Percent" },
  { char: "‰", label: "Per mille" },
  { char: "①", label: "Circled 1" },
  { char: "②", label: "Circled 2" },
  { char: "③", label: "Circled 3" },
];

interface SpecialCharsPickerProps {
  onSelect: (char: string) => void;
}

export function SpecialCharsPicker({ onSelect }: SpecialCharsPickerProps) {
  return (
    <div>
      <p className="text-slate-500 mb-1.5 text-[11px] font-medium uppercase tracking-wide">Ký tự đặc biệt</p>
      <div className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto">
        {SPECIAL_CHARS.map((s) => (
          <button
            key={s.char}
            type="button"
            onClick={() => onSelect(s.char)}
            className="hover:bg-slate-100 text-slate-900 flex h-8 w-8 items-center justify-center rounded text-base"
            title={s.label}
          >
            {s.char}
          </button>
        ))}
      </div>
    </div>
  );
}

const COLOR_PALETTE = [
  // Row 1: brand + neutral
  "#000000", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6", "#FFFFFF",
  // Row 2: blue (FSC primary)
  "#0066B3", "#1E40AF", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#DBEAFE",
  // Row 3: orange (FSC CTA)
  "#F37021", "#C2410C", "#EA580C", "#F97316", "#FB923C", "#FDBA74", "#FED7AA",
  // Row 4: green
  "#0DB14B", "#047857", "#059669", "#10B981", "#34D399", "#6EE7B7", "#A7F3D0",
  // Row 5: red
  "#DC2626", "#991B1B", "#B91C1C", "#EF4444", "#F87171", "#FCA5A5", "#FECACA",
  // Row 6: purple/yellow
  "#7C3AED", "#5B21B6", "#8B5CF6", "#A78BFA", "#FBBF24", "#FDE68A", "#FEF3C7",
];

interface ColorPickerProps {
  onSelect: (hex: string | null) => void;
  /** Label hiển thị ở header (vd "Màu chữ", "Highlight"). */
  label: string;
  /** Show "Bỏ màu" option. */
  allowUnset?: boolean;
}

export function ColorPicker({ onSelect, label, allowUnset = true }: ColorPickerProps) {
  const [custom, setCustom] = useState("#000000");
  return (
    <div>
      <p className="text-slate-500 mb-1.5 text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-7 gap-1">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            className="h-6 w-6 rounded border border-slate-200 transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-slate-200"
          aria-label="Custom color"
        />
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs"
          placeholder="#000000"
        />
        <button
          type="button"
          onClick={() => onSelect(custom)}
          className={cn(
            "rounded-md border border-blue-500 bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700",
          )}
        >
          OK
        </button>
      </div>
      {allowUnset && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-slate-500 hover:text-slate-900 mt-2 w-full rounded-md border border-slate-200 bg-slate-100 py-1 text-xs"
        >
          Bỏ màu
        </button>
      )}
    </div>
  );
}
