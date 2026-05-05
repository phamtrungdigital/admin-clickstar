"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { AtSign } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  listInternalStaffForMention,
  type MentionStaffOption,
} from "@/app/(dashboard)/mention-staff-action";

type Props = Omit<
  ComponentPropsWithoutRef<typeof Textarea>,
  "value" | "onChange" | "ref"
> & {
  value: string;
  onChange: (next: string) => void;
  /** Bật/tắt autocomplete @mention. Customer-side dùng false. */
  enableMention?: boolean;
};

/**
 * Textarea hỗ trợ @mention internal staff. Khi user gõ "@", popup gợi ý
 * hiện ra ngay dưới (relative position). Phím tắt:
 * - ↑/↓: di chuyển trong list
 * - Enter / Tab: chọn user đang highlight
 * - Esc: đóng popup
 *
 * Format insert: `@[Tên Hiển Thị](uuid)` — parse được ở cả backend
 * (notify) và frontend (render). Khi popup đóng, Enter behave như
 * textarea bình thường (xuống dòng).
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function MentionTextarea(
    { value, onChange, enableMention = true, className, onKeyDown, ...rest },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        textareaRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      },
      [ref],
    );

    const [staff, setStaff] = useState<MentionStaffOption[] | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightIdx, setHighlightIdx] = useState(0);
    /** Vị trí "@" trong textarea — dùng để replace khi chọn */
    const [triggerStart, setTriggerStart] = useState<number | null>(null);

    // Lazy load staff list 1 lần khi component mount + mention enabled.
    // Server action cache trong-process — render sau gọi gần như instant.
    useEffect(() => {
      if (!enableMention || staff !== null) return;
      let cancelled = false;
      listInternalStaffForMention()
        .then((data) => {
          if (!cancelled) setStaff(data);
        })
        .catch(() => {
          if (!cancelled) setStaff([]);
        });
      return () => {
        cancelled = true;
      };
    }, [enableMention, staff]);

    const filtered = useMemo(() => {
      if (!staff) return [];
      const q = query.trim().toLowerCase();
      const list = q
        ? staff.filter((s) => s.full_name.toLowerCase().includes(q))
        : staff;
      return list.slice(0, 8);
    }, [staff, query]);

    const closePopup = useCallback(() => {
      setOpen(false);
      setQuery("");
      setTriggerStart(null);
      setHighlightIdx(0);
    }, []);

    const detectTrigger = useCallback(
      (text: string, caret: number) => {
        if (!enableMention) return;
        // Tìm "@" gần nhất trước caret, không bị break bởi space / xuống dòng.
        let idx = caret - 1;
        let found = -1;
        while (idx >= 0) {
          const ch = text[idx];
          if (ch === "@") {
            // Trigger phải đứng đầu string hoặc sau khoảng trắng
            const prev = idx > 0 ? text[idx - 1] : " ";
            if (prev === " " || prev === "\n" || prev === "\t" || idx === 0) {
              found = idx;
            }
            break;
          }
          if (ch === " " || ch === "\n" || ch === "\t") break;
          idx--;
        }
        if (found === -1) {
          if (open) closePopup();
          return;
        }
        const q = text.slice(found + 1, caret);
        // Đóng nếu query có ký tự đặc biệt (vd "(") — đã thành mention rồi
        if (q.includes("(") || q.includes(")") || q.includes("[")) {
          if (open) closePopup();
          return;
        }
        setTriggerStart(found);
        setQuery(q);
        setHighlightIdx(0);
        setOpen(true);
      },
      [enableMention, open, closePopup],
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      onChange(text);
      detectTrigger(text, e.target.selectionStart ?? text.length);
    };

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      detectTrigger(el.value, el.selectionStart ?? el.value.length);
    };

    const insertMention = (s: MentionStaffOption) => {
      if (triggerStart === null) return;
      const el = textareaRef.current;
      const caret =
        el?.selectionStart ?? triggerStart + 1 + query.length;
      const before = value.slice(0, triggerStart);
      const after = value.slice(caret);
      const insert = `@[${s.full_name}](${s.id}) `;
      const next = before + insert + after;
      onChange(next);
      closePopup();
      // Focus lại textarea + đặt caret ngay sau mention
      requestAnimationFrame(() => {
        if (!el) return;
        const pos = (before + insert).length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (open && filtered.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightIdx((i) => (i + 1) % filtered.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightIdx(
            (i) => (i - 1 + filtered.length) % filtered.length,
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(filtered[highlightIdx]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closePopup();
          return;
        }
      }
      onKeyDown?.(e);
    };

    return (
      <div className="relative">
        <Textarea
          {...rest}
          ref={setRef}
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          className={className}
        />
        {open && filtered.length > 0 && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <AtSign className="h-3 w-3" />
              Tag nhân viên {query && `· "${query}"`}
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {filtered.map((s, idx) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // mousedown để chọn TRƯỚC khi textarea blur
                      e.preventDefault();
                      insertMention(s);
                    }}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                      idx === highlightIdx
                        ? "bg-blue-50 text-blue-900"
                        : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-medium text-slate-700">
                      {initials(s.full_name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {s.full_name}
                    </span>
                    {s.internal_role && (
                      <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {ROLE_LABEL[s.internal_role] ?? s.internal_role}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  },
);

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super",
  admin: "Admin",
  manager: "Manager",
  staff: "NV",
  support: "CSKH",
  accountant: "KT",
};

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
