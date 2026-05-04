import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  EmailLogRow,
  EmailTemplateRow,
  MessageStatus,
} from "@/lib/database.types";

export type EmailTemplateListItem = EmailTemplateRow & {
  creator: { id: string; full_name: string } | null;
};

export async function listEmailTemplates(): Promise<EmailTemplateListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select(
      `
      *,
      creator:profiles!email_templates_created_by_fkey ( id, full_name )
      `,
    )
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as EmailTemplateListItem[];
}

export async function getEmailTemplateById(
  id: string,
): Promise<EmailTemplateListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select(
      `
      *,
      creator:profiles!email_templates_created_by_fkey ( id, full_name )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as unknown) as EmailTemplateListItem | null) ?? null;
}

export type EmailLogListItem = EmailLogRow & {
  template: { id: string; code: string; name: string } | null;
};

export type EmailLogListParams = {
  status?: MessageStatus | "all";
  page?: number;
  pageSize?: number;
};

export async function listEmailLogs(params: EmailLogListParams = {}): Promise<{
  rows: EmailLogListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 30));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("email_logs")
    .select(
      `
      *,
      template:email_templates!email_logs_template_id_fkey ( id, code, name )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    rows: ((data ?? []) as unknown) as EmailLogListItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}
