import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DocumentKind, DocumentRow, DocumentVisibility } from "@/lib/database.types";

export type DocumentListItem = DocumentRow & {
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  contract: { id: string; code: string | null } | null;
  uploader: { id: string; full_name: string } | null;
};

export type DocumentListParams = {
  search?: string;
  kind?: DocumentKind | "all";
  visibility?: DocumentVisibility | "all";
  company_id?: string;
  project_id?: string;
  contract_id?: string;
  page?: number;
  pageSize?: number;
};

export type DocumentListResult = {
  rows: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const SELECT_RELATIONS = `
  *,
  company:companies!documents_company_id_fkey ( id, name ),
  project:projects!documents_project_id_fkey ( id, name ),
  contract:contracts!documents_contract_id_fkey ( id, code ),
  uploader:profiles!documents_uploaded_by_fkey ( id, full_name )
`;

export async function listDocuments(
  params: DocumentListParams = {},
): Promise<DocumentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select(SELECT_RELATIONS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    query = query.ilike("name", `%${params.search.trim()}%`);
  }
  if (params.kind && params.kind !== "all") {
    query = query.eq("kind", params.kind);
  }
  if (params.visibility && params.visibility !== "all") {
    query = query.eq("visibility", params.visibility);
  }
  if (params.company_id) query = query.eq("company_id", params.company_id);
  if (params.project_id) query = query.eq("project_id", params.project_id);
  if (params.contract_id) query = query.eq("contract_id", params.contract_id);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: ((data ?? []) as unknown) as DocumentListItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getDocumentById(
  id: string,
): Promise<DocumentListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_RELATIONS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as unknown) as DocumentListItem | null) ?? null;
}

/** Signed URL for downloading a private file. RLS on storage.objects
 *  re-checks visibility against the documents row, so a customer who
 *  somehow obtained a path cannot download an internal-only file. */
export async function getDocumentSignedUrl(
  storagePath: string,
  ttlSeconds = 60 * 10,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function listDocumentsForProject(
  projectId: string,
  pageSize = 50,
): Promise<DocumentListItem[]> {
  const result = await listDocuments({ project_id: projectId, pageSize });
  return result.rows;
}
