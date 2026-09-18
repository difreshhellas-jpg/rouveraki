-- ============================================================================
--  Rouveraki — Supabase setup that is NOT covered by `prisma db push`.
--  Run this once in the Supabase SQL editor, after the Prisma schema is pushed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lock the application tables down completely.
--
-- Every read and write goes through this app's own API routes using the Prisma
-- connection (which bypasses RLS as the database owner). The anon and
-- authenticated Supabase roles must never be able to touch these tables
-- directly: `orders` holds customer names, phones and addresses.
--
-- RLS on with zero policies = deny everything for anon/authenticated.
-- ---------------------------------------------------------------------------
alter table public.menu_items            enable row level security;
alter table public.customers             enable row level security;
alter table public.orders                enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.payments              enable row level security;
alter table public.refunds               enable row level security;
alter table public.webhook_events        enable row level security;

revoke all on public.customers            from anon, authenticated;
revoke all on public.orders               from anon, authenticated;
revoke all on public.order_status_history from anon, authenticated;
revoke all on public.payments             from anon, authenticated;
revoke all on public.refunds              from anon, authenticated;
revoke all on public.webhook_events       from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Realtime broadcast authorisation.
--
-- The app publishes on two kinds of channel:
--   order:<CODE>   public   — the customer tracking page listens here
--   staff-orders   private  — the admin/kitchen screens listen here
--
-- Supabase authorises private channels through RLS on realtime.messages.
-- Only a signed-in user carrying a staff/admin role in app_metadata may
-- read the staff channel.
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'),
    false
  );
$$;

drop policy if exists "staff can read staff-orders" on realtime.messages;
create policy "staff can read staff-orders"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() = 'staff-orders'
    and extension = 'broadcast'
    and public.is_staff()
  );

-- Nobody writes to the staff channel from a browser; the server publishes with
-- the service role, which is not subject to RLS. No INSERT policy is created on
-- purpose — a compromised staff browser still cannot forge order events.

-- ---------------------------------------------------------------------------
-- 3. Granting a staff role to a user.
--
-- Run once per employee after they have been invited through Supabase Auth.
-- app_metadata is chosen over user_metadata deliberately: user_metadata is
-- writable by the user themselves and must never carry authorisation.
-- ---------------------------------------------------------------------------
-- update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                            || '{"role":"staff"}'::jsonb
--  where email = 'someone@example.com';

-- ---------------------------------------------------------------------------
-- 4. Data retention (GDPR §6).
--
-- Customer identifiers on completed orders are cleared after 24 months. The
-- order row itself is kept because tax law requires the sales record; what it
-- does not require is the customer's name, phone and address forever.
-- Schedule with pg_cron, or run from a monthly job.
-- ---------------------------------------------------------------------------
create or replace function public.anonymise_old_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.orders
     set customer_name    = 'ΔΙΑΓΡΑΦΕΝ',
         customer_phone   = '',
         customer_address = null,
         general_notes    = null,
         customer_id      = null
   where created_at < now() - interval '24 months'
     and customer_name <> 'ΔΙΑΓΡΑΦΕΝ';
  get diagnostics affected = row_count;

  delete from public.customers c
   where not exists (select 1 from public.orders o where o.customer_id = c.id)
     and c.created_at < now() - interval '24 months';

  return affected;
end;
$$;

-- select cron.schedule('anonymise-orders', '0 4 1 * *', $$select public.anonymise_old_orders()$$);
