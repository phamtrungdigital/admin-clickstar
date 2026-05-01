-- 0016_tickets_attachments.sql
-- Add an attachments array to tickets so customers/staff can attach
-- screenshots and files when reporting / handling an issue.
--
-- Each element shape: {
--   path:         string  -- key inside the `documents` storage bucket
--   filename:     string
--   content_type: string
--   size:         number  -- bytes
--   uploaded_at:  string  -- ISO timestamp
-- }

alter table public.tickets
  add column if not exists attachments jsonb not null default '[]'::jsonb;
