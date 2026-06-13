-- ===========================================================================
-- RFQ Automation Platform — initial schema
-- ===========================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Designed for low-volume, single-operator usage.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- rfqs
-- ---------------------------------------------------------------------------
create table if not exists public.rfqs (
  id               uuid primary key default gen_random_uuid(),
  reference_number text not null,
  uploaded_at      timestamptz not null default now(),
  file_path        text
);

-- ---------------------------------------------------------------------------
-- rfq_items
-- ---------------------------------------------------------------------------
create table if not exists public.rfq_items (
  id             uuid primary key default gen_random_uuid(),
  rfq_id         uuid not null references public.rfqs(id) on delete cascade,
  item_number    integer not null,           -- sequential display number (1, 2, 3 ...)
  part_number    text,
  manufacturer   text,
  product        text,
  box_size       text,
  application    text,
  analyzer_model text,
  tag_number     text,
  quantity       numeric,
  unit           text,
  status         text not null default 'PENDING_SEARCH'
                   check (status in (
                     'PENDING_SEARCH','FOUND','NOT_FOUND',
                     'READY_TO_SEND','EMAIL_SENT','EMAIL_FAILED'
                   )),
  created_at     timestamptz not null default now()
);
create index if not exists rfq_items_rfq_id_idx on public.rfq_items(rfq_id);
create index if not exists rfq_items_status_idx on public.rfq_items(status);

-- ---------------------------------------------------------------------------
-- suppliers  (only exact part-number matches are ever inserted)
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  rfq_item_id      uuid not null references public.rfq_items(id) on delete cascade,
  supplier_name    text,
  website          text,
  product_url      text,
  email            text,
  email_source_url text,
  -- How the supplier was matched: exact part number, description search, or
  -- manufacturer-direct (listing not confirmed). Drives confidence in the UI.
  match_type       text check (match_type in ('PART_NUMBER','DESCRIPTION','MANUFACTURER')),
  created_at       timestamptz not null default now()
);
create index if not exists suppliers_rfq_item_id_idx on public.suppliers(rfq_item_id);

-- ---------------------------------------------------------------------------
-- email_logs
-- ---------------------------------------------------------------------------
create table if not exists public.email_logs (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  recipient_email text not null,
  sent_at         timestamptz,
  message_id      text,
  status          text not null check (status in ('SENT','FAILED')),
  created_at      timestamptz not null default now()
);
create index if not exists email_logs_supplier_id_idx on public.email_logs(supplier_id);

-- ---------------------------------------------------------------------------
-- ms_oauth_tokens  (single-row store for the Outlook OAuth token set)
-- Supporting table for the Microsoft Graph integration.
-- ---------------------------------------------------------------------------
create table if not exists public.ms_oauth_tokens (
  id            text primary key default 'default',
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  account_email text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Storage bucket for RFQ PDFs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('rfq-pdfs', 'rfq-pdfs', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The server uses the service-role key (which bypasses RLS) for all data
-- access, so these policies only matter if you query from the browser with the
-- anon/authenticated key. They grant full access to signed-in users (the
-- single procurement operator). Tighten as needed.
-- ---------------------------------------------------------------------------
alter table public.rfqs            enable row level security;
alter table public.rfq_items       enable row level security;
alter table public.suppliers       enable row level security;
alter table public.email_logs      enable row level security;
alter table public.ms_oauth_tokens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rfqs','rfq_items','suppliers','email_logs','ms_oauth_tokens']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
exception when duplicate_object then null;
end $$;
