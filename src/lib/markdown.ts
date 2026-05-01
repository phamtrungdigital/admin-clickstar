import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Render a trusted-but-user-authored Markdown string to safe HTML.
 * Used for report bodies + comment renderings — input comes from PMs we
 * trust, but we still sanitize so a copy/pasted "<script>" never lands in
 * the DOM.
 */
export function renderMarkdown(input: string): string {
  if (!input) return "";
  const raw = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}
