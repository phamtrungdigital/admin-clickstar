/**
 * TypeScript types for the Supabase schema (hand-written to match
 * supabase/migrations/0001-0012).  Re-generate from the project once
 * the Supabase CLI is wired up:
 *   supabase gen types typescript --project-id kdzorsvjefcmmtefvbrx \
 *     --schema public > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type InternalRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "staff"
  | "support"
  | "accountant";

export type CustomerRole = "owner" | "marketing_manager" | "viewer";

export type AssignmentRole =
  | "account_manager"
  | "implementer"
  | "support"
  | "accountant";

export type Audience = "internal" | "customer";

export type CompanyStatus = "new" | "active" | "paused" | "ended";

export type ContractStatus =
  | "draft"
  | "signed"
  | "active"
  | "completed"
  | "cancelled";

export type ServiceStatus =
  | "not_started"
  | "active"
  | "awaiting_customer"
  | "awaiting_review"
  | "completed"
  | "paused";

export type TaskStatus =
  | "todo"
  | "assigned"
  | "in_progress"
  | "awaiting_customer"
  | "blocked"
  | "awaiting_review"
  | "returned"
  | "done"
  | "cancelled";

export type TaskExtraSource = "internal" | "customer" | "risk";

export type SnapshotType =
  | "weekly"
  | "milestone"
  | "deliverable"
  | "extra_task";

export type SnapshotStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "auto_published"
  | "rejected"
  | "rolled_back";

export type ReportStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus =
  | "new"
  | "in_progress"
  | "awaiting_customer"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type DocumentVisibility = "internal" | "shared" | "public";

export type DocumentKind =
  | "contract"
  | "addendum"
  | "acceptance"
  | "brief"
  | "report"
  | "design"
  | "ad_creative"
  | "seo"
  | "other";

export type MessageStatus =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced";

export type AutomationEventStatus =
  | "pending"
  | "sent"
  | "failed"
  | "retried";

export type NotificationChannel = "in_app" | "email" | "zns";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type SoftDeletable = {
  deleted_at: string | null;
};

export interface ProfileRow extends Timestamps, SoftDeletable {
  id: string;
  full_name: string;
  avatar_url: string | null;
  audience: Audience;
  internal_role: InternalRole | null;
  phone: string | null;
  is_active: boolean;
  metadata: Json;
}

export interface CompanyRow extends Timestamps, SoftDeletable {
  id: string;
  code: string | null;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_code: string | null;
  representative: string | null;
  status: CompanyStatus;
  metadata: Json;
  created_by: string | null;
}

export interface CompanyMemberRow extends Timestamps {
  id: string;
  company_id: string;
  user_id: string;
  role: CustomerRole;
}

export interface CompanyAssignmentRow extends Timestamps {
  id: string;
  company_id: string;
  internal_user_id: string;
  role: AssignmentRole;
  is_primary: boolean;
}

export interface ContractRow extends Timestamps, SoftDeletable {
  id: string;
  code: string | null;
  company_id: string;
  name: string;
  total_value: number;
  currency: string;
  vat_percent: number;
  signed_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: ContractStatus;
  notes: string | null;
  attachment_url: string | null;
  attachment_filename: string | null;
  metadata: Json;
  created_by: string | null;
}

export interface ServiceRow extends Timestamps {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
  default_price: number;
  billing_cycle: string | null;
  metadata: Json;
}

export interface ContractServiceRow extends Timestamps {
  id: string;
  contract_id: string;
  service_id: string;
  unit_price: number;
  quantity: number;
  status: ServiceStatus;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
}

export interface CompanyServiceRow {
  company_id: string;
  service_id: string;
  created_at: string;
}

export interface ProjectRow extends Timestamps, SoftDeletable {
  id: string;
  company_id: string;
  contract_id: string | null;
  contract_service_id: string | null;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: ServiceStatus;
  primary_owner_id: string | null;
  template_id: string | null;
  template_version: number | null;
  pm_id: string | null;
  progress_percent: number;
  scheduling_mode: SchedulingMode;
  metadata: Json;
  created_by: string | null;
}

export type SchedulingMode = "auto" | "manual" | "rolling";

export interface TaskRow extends Timestamps, SoftDeletable {
  id: string;
  company_id: string;
  project_id: string | null;
  contract_service_id: string | null;
  milestone_id: string | null;
  template_task_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  reporter_id: string | null;
  reviewer_id: string | null;
  due_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  is_visible_to_customer: boolean;
  is_extra: boolean;
  extra_source: TaskExtraSource | null;
  metadata: Json;
  created_by: string | null;
}

export interface ServiceTemplateRow extends Timestamps, SoftDeletable {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  duration_days: number | null;
  version: number;
  is_active: boolean;
  metadata: Json;
  created_by: string | null;
}

export interface TemplateMilestoneRow extends Timestamps {
  id: string;
  template_id: string;
  code: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  offset_start_days: number;
  offset_end_days: number;
  deliverable_required: boolean;
}

export interface TemplateTaskRow extends Timestamps {
  id: string;
  template_id: string;
  template_milestone_id: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  default_role: string | null;
  offset_days: number;
  duration_days: number;
  priority: TaskPriority;
  is_visible_to_customer: boolean;
}

export interface TemplateChecklistItemRow {
  id: string;
  template_task_id: string;
  content: string;
  sort_order: number;
  created_at: string;
}

export interface MilestoneRow extends Timestamps {
  id: string;
  project_id: string;
  template_milestone_id: string | null;
  code: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  status: ServiceStatus;
  progress_percent: number;
  deliverable_required: boolean;
}

export interface TaskChecklistItemRow extends Timestamps {
  id: string;
  task_id: string;
  content: string;
  sort_order: number;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
}

export interface SnapshotRow extends Timestamps {
  id: string;
  project_id: string;
  contract_id: string;
  type: SnapshotType;
  status: SnapshotStatus;
  payload: Json;
  notes: string | null;
  auto_publish_at: string | null;
  rollback_until: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
}

export interface TaskCommentRow extends Timestamps, SoftDeletable {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  attachments: Json;
}

export interface TicketAttachment {
  path: string;
  filename: string;
  content_type: string;
  size: number;
  uploaded_at: string;
}

export interface TicketRow extends Timestamps, SoftDeletable {
  id: string;
  code: string | null;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id: string | null;
  reporter_id: string | null;
  closed_at: string | null;
  metadata: Json;
  attachments: TicketAttachment[];
  created_by: string | null;
}

export interface TicketCommentRow extends Timestamps, SoftDeletable {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  attachments: Json;
}

export interface DocumentRow extends Timestamps, SoftDeletable {
  id: string;
  /** Owning company. NULL = internal-only Clickstar document
   *  (training, processes, brand guides, ...). */
  company_id: string | null;
  contract_id: string | null;
  project_id: string | null;
  ticket_id: string | null;
  kind: DocumentKind;
  name: string;
  description: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: DocumentVisibility;
  metadata: Json;
  uploaded_by: string | null;
}

export interface EmailTemplateRow extends Timestamps {
  id: string;
  code: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: Json;
  is_active: boolean;
  created_by: string | null;
}

export interface EmailCampaignRow extends Timestamps {
  id: string;
  code: string | null;
  template_id: string | null;
  company_id: string | null;
  name: string;
  description: string | null;
  audience_filter: Json;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  metadata: Json;
  created_by: string | null;
}

export interface EmailLogRow extends Timestamps {
  id: string;
  campaign_id: string | null;
  template_id: string | null;
  company_id: string | null;
  recipient_user_id: string | null;
  recipient_email: string;
  subject: string;
  payload: Json;
  status: MessageStatus;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
}

export interface ZnsTemplateRow extends Timestamps {
  id: string;
  code: string;
  name: string;
  category: string | null;
  variables: Json;
  is_active: boolean;
  created_by: string | null;
}

export interface ZnsLogRow extends Timestamps {
  id: string;
  template_id: string | null;
  company_id: string | null;
  recipient_user_id: string | null;
  recipient_phone: string;
  payload: Json;
  status: MessageStatus;
  provider_message_id: string | null;
  error_message: string | null;
  campaign_code: string | null;
  sent_at: string | null;
}

export interface ReportRow extends Timestamps, SoftDeletable {
  id: string;
  company_id: string;
  contract_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  status: ReportStatus;
  period_start: string | null;
  period_end: string | null;
  document_id: string | null;
  highlights: Json;
  is_published: boolean;
  published_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  metadata: Json;
  created_by: string | null;
}

export type AiProvider = "anthropic" | "openai";

export interface AiIntegrationRow extends Timestamps {
  id: string;
  provider: AiProvider;
  model: string;
  /** uuid trỏ vào vault.secrets — không bao giờ contain plaintext key. */
  vault_secret_id: string;
  /** Mask "sk-•••abc1" cho admin nhận diện trong UI. */
  key_mask: string;
  is_active: boolean;
  label: string | null;
  notes: string | null;
  created_by: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  company_id: string | null;
  channel: NotificationChannel;
  title: string;
  body: string | null;
  link_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  metadata: Json;
  created_at: string;
}

export interface AutomationEventRow extends Timestamps {
  id: string;
  event_name: string;
  company_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Json;
  webhook_url: string | null;
  status: AutomationEventStatus;
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
}

export interface AuditLogRow {
  id: number;
  user_id: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Json | null;
  new_value: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

type Insertable<T> = Omit<
  T,
  "id" | "created_at" | "updated_at" | "deleted_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

type Updatable<T> = Partial<Insertable<T>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow>;
        Update: Updatable<ProfileRow>;
        Relationships: [];
      };
      companies: {
        Row: CompanyRow;
        Insert: Insertable<CompanyRow>;
        Update: Updatable<CompanyRow>;
        Relationships: [];
      };
      company_members: {
        Row: CompanyMemberRow;
        Insert: Insertable<CompanyMemberRow>;
        Update: Updatable<CompanyMemberRow>;
        Relationships: [];
      };
      company_assignments: {
        Row: CompanyAssignmentRow;
        Insert: Insertable<CompanyAssignmentRow>;
        Update: Updatable<CompanyAssignmentRow>;
        Relationships: [];
      };
      contracts: {
        Row: ContractRow;
        Insert: Insertable<ContractRow>;
        Update: Updatable<ContractRow>;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: Insertable<ServiceRow>;
        Update: Updatable<ServiceRow>;
        Relationships: [];
      };
      contract_services: {
        Row: ContractServiceRow;
        Insert: Insertable<ContractServiceRow>;
        Update: Updatable<ContractServiceRow>;
        Relationships: [];
      };
      company_services: {
        Row: CompanyServiceRow;
        Insert: CompanyServiceRow;
        Update: Partial<CompanyServiceRow>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: Insertable<ProjectRow>;
        Update: Updatable<ProjectRow>;
        Relationships: [];
      };
      service_templates: {
        Row: ServiceTemplateRow;
        Insert: Insertable<ServiceTemplateRow>;
        Update: Updatable<ServiceTemplateRow>;
        Relationships: [];
      };
      template_milestones: {
        Row: TemplateMilestoneRow;
        Insert: Insertable<TemplateMilestoneRow>;
        Update: Updatable<TemplateMilestoneRow>;
        Relationships: [];
      };
      template_tasks: {
        Row: TemplateTaskRow;
        Insert: Insertable<TemplateTaskRow>;
        Update: Updatable<TemplateTaskRow>;
        Relationships: [];
      };
      template_checklist_items: {
        Row: TemplateChecklistItemRow;
        Insert: TemplateChecklistItemRow;
        Update: Partial<TemplateChecklistItemRow>;
        Relationships: [];
      };
      milestones: {
        Row: MilestoneRow;
        Insert: Insertable<MilestoneRow>;
        Update: Updatable<MilestoneRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: Insertable<TaskRow>;
        Update: Updatable<TaskRow>;
        Relationships: [];
      };
      task_checklist_items: {
        Row: TaskChecklistItemRow;
        Insert: Insertable<TaskChecklistItemRow>;
        Update: Updatable<TaskChecklistItemRow>;
        Relationships: [];
      };
      snapshots: {
        Row: SnapshotRow;
        Insert: Insertable<SnapshotRow>;
        Update: Updatable<SnapshotRow>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskCommentRow;
        Insert: Insertable<TaskCommentRow>;
        Update: Updatable<TaskCommentRow>;
        Relationships: [];
      };
      tickets: {
        Row: TicketRow;
        Insert: Insertable<TicketRow>;
        Update: Updatable<TicketRow>;
        Relationships: [];
      };
      ticket_comments: {
        Row: TicketCommentRow;
        Insert: Insertable<TicketCommentRow>;
        Update: Updatable<TicketCommentRow>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: Insertable<DocumentRow>;
        Update: Updatable<DocumentRow>;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplateRow;
        Insert: Insertable<EmailTemplateRow>;
        Update: Updatable<EmailTemplateRow>;
        Relationships: [];
      };
      email_campaigns: {
        Row: EmailCampaignRow;
        Insert: Insertable<EmailCampaignRow>;
        Update: Updatable<EmailCampaignRow>;
        Relationships: [];
      };
      email_logs: {
        Row: EmailLogRow;
        Insert: Insertable<EmailLogRow>;
        Update: Updatable<EmailLogRow>;
        Relationships: [];
      };
      zns_templates: {
        Row: ZnsTemplateRow;
        Insert: Insertable<ZnsTemplateRow>;
        Update: Updatable<ZnsTemplateRow>;
        Relationships: [];
      };
      zns_logs: {
        Row: ZnsLogRow;
        Insert: Insertable<ZnsLogRow>;
        Update: Updatable<ZnsLogRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: Insertable<ReportRow>;
        Update: Updatable<ReportRow>;
        Relationships: [];
      };
      ai_integrations: {
        Row: AiIntegrationRow;
        Insert: Insertable<AiIntegrationRow>;
        Update: Updatable<AiIntegrationRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      automation_events: {
        Row: AutomationEventRow;
        Insert: Insertable<AutomationEventRow>;
        Update: Updatable<AutomationEventRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_user_id: { Args: Record<string, never>; Returns: string | null };
      current_audience: {
        Args: Record<string, never>;
        Returns: Audience | null;
      };
      current_internal_role: {
        Args: Record<string, never>;
        Returns: InternalRole | null;
      };
      is_internal: { Args: Record<string, never>; Returns: boolean };
      is_internal_admin: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      current_customer_companies: {
        Args: Record<string, never>;
        Returns: string[];
      };
      current_assigned_companies: {
        Args: Record<string, never>;
        Returns: string[];
      };
      accessible_company_ids: {
        Args: Record<string, never>;
        Returns: string[] | null;
      };
      can_access_company: {
        Args: { target_company: string };
        Returns: boolean;
      };
    };
    Enums: {
      audience: Audience;
      internal_role: InternalRole;
      customer_role: CustomerRole;
      assignment_role: AssignmentRole;
      company_status: CompanyStatus;
      contract_status: ContractStatus;
      service_status: ServiceStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      ticket_status: TicketStatus;
      ticket_priority: TicketPriority;
      document_visibility: DocumentVisibility;
      document_kind: DocumentKind;
      message_status: MessageStatus;
      automation_event_status: AutomationEventStatus;
      notification_channel: NotificationChannel;
    };
  };
}
