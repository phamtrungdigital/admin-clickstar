/**
 * Tiny Handlebars-like renderer for email templates. Replaces every
 * `{{var}}` (or `{{ var }}`) occurrence with the matching key from
 * `vars`. Unknown placeholders are left as-is so the rendered output
 * makes it obvious that data is missing — easier to spot in QA than
 * a silent empty string.
 *
 *   render("Xin chào {{name}}, ticket {{code}} của bạn...", {
 *     name: "Maria",
 *     code: "TKT-2026-0001",
 *   })
 *   → "Xin chào Maria, ticket TKT-2026-0001 của bạn..."
 *
 * Use this both for `subject` and `html_body` / `text_body`.
 */
export function renderEmailTemplate(
  source: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    if (v === null || v === undefined) return match;
    return String(v);
  });
}

/** Pull placeholders out of a template — for showing "this template
 *  expects: name, ticket_code, link" hints in the UI. */
export function extractEmailVariables(source: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    set.add(m[1]);
  }
  return [...set].sort();
}
