-- ShadowBridge: bridge transaction history
-- Run this once in your Supabase SQL editor or via supabase db push

create table if not exists bridge_transactions (
  burn_tx_hash      text primary key,
  source_chain_id   integer not null,
  source_domain     integer not null,
  dest_domain       integer not null,
  recipient         text    not null,
  status            text    not null check (status in ('pending','attesting','relaying','completed','failed')),
  relay_tx_hash     text,
  error             text,
  message_bytes     text,
  attestation       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index for per-user history queries
create index if not exists idx_bridge_recipient on bridge_transactions (recipient, created_at desc);

-- Index for resuming in-flight relays on restart
create index if not exists idx_bridge_status on bridge_transactions (status) where status in ('pending','attesting','relaying');

-- Row-level security: service role has full access, anon has none
alter table bridge_transactions enable row level security;

-- Allow the service role (backend) to do everything
create policy "service_role_all" on bridge_transactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
