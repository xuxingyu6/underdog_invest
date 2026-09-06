-- Portfolio cloud snapshot for Underdog Invest.
-- Maps the existing local JSON model (holdings / trades / returns /
-- clearedHoldings / removedHoldings / priceHistory) to one row per
-- authenticated user. JSONB keeps import/export 1:1 and makes sync atomic.

create table if not exists public.portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  holdings jsonb not null default '[]'::jsonb,
  trades jsonb not null default '[]'::jsonb,
  returns jsonb not null default '[]'::jsonb,
  cleared_holdings jsonb not null default '[]'::jsonb,
  removed_holdings jsonb not null default '[]'::jsonb,
  price_history jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_portfolios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
before update on public.portfolios
for each row
execute function public.set_portfolios_updated_at();
-- If the editor rejects EXECUTE FUNCTION, replace the last line with:
-- execute procedure public.set_portfolios_updated_at();

alter table public.portfolios enable row level security;

drop policy if exists "Users can select own portfolio" on public.portfolios;
create policy "Users can select own portfolio"
  on public.portfolios
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own portfolio" on public.portfolios;
create policy "Users can insert own portfolio"
  on public.portfolios
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own portfolio" on public.portfolios;
create policy "Users can update own portfolio"
  on public.portfolios
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own portfolio" on public.portfolios;
create policy "Users can delete own portfolio"
  on public.portfolios
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.portfolios to authenticated;
