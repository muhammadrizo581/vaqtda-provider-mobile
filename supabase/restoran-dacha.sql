-- ============================================================
-- Restoran va Dacha/Villa kategoriyalari uchun baza o'zgarishlari
-- Ishga tushirish: Supabase Dashboard -> SQL Editor -> New query
-- Bir necha marta ishga tushirsa ham xavfsiz (idempotent).
-- ============================================================

-- 1) Kategoriya bron rejimi:
--    slots  — oddiy (soatlik xizmat, hozirgi holat)
--    table  — restoran: mijoz sana + vaqt + stol tanlaydi
--    daily  — dacha/villa: mijoz kelish–ketish sanalarini tanlaydi (kunlik)
alter table public.categories
  add column if not exists booking_mode text not null default 'slots';

alter table public.categories
  drop constraint if exists categories_booking_mode_check;
alter table public.categories
  add constraint categories_booking_mode_check
  check (booking_mode in ('slots', 'table', 'daily'));

-- 2) Restoran va Dacha kategoriyalari (slug bo'yicha, takror qo'shilmaydi)
insert into public.categories (name, slug, booking_mode)
select '{"uz":"Restoran","ru":"Ресторан","en":"Restaurant"}'::jsonb, 'restoran', 'table'
where not exists (select 1 from public.categories where slug = 'restoran');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Dacha va villalar","ru":"Дачи и виллы","en":"Cottages & villas"}'::jsonb, 'dacha', 'daily'
where not exists (select 1 from public.categories where slug = 'dacha');

-- Mavjud bo'lsa ham rejimni to'g'rilab qo'yamiz
update public.categories set booking_mode = 'table' where slug = 'restoran';
update public.categories set booking_mode = 'daily' where slug = 'dacha';

-- 3) Restoran stollari
create table if not exists public.restaurant_tables (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name        text not null,
  capacity    integer not null default 2 check (capacity > 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists restaurant_tables_provider_idx
  on public.restaurant_tables (provider_id);

alter table public.restaurant_tables enable row level security;

-- Mijozlar (hamma) stollarni ko'ra oladi — bron qilishda tanlash uchun
drop policy if exists "tables_select_all" on public.restaurant_tables;
create policy "tables_select_all" on public.restaurant_tables
  for select using (true);

-- Provider faqat o'z stollarini qo'shadi/o'zgartiradi/o'chiradi
drop policy if exists "tables_insert_own" on public.restaurant_tables;
create policy "tables_insert_own" on public.restaurant_tables
  for insert with check (
    exists (select 1 from public.providers p
            where p.id = provider_id and p.user_id = auth.uid())
  );

drop policy if exists "tables_update_own" on public.restaurant_tables;
create policy "tables_update_own" on public.restaurant_tables
  for update using (
    exists (select 1 from public.providers p
            where p.id = provider_id and p.user_id = auth.uid())
  );

drop policy if exists "tables_delete_own" on public.restaurant_tables;
create policy "tables_delete_own" on public.restaurant_tables
  for delete using (
    exists (select 1 from public.providers p
            where p.id = provider_id and p.user_id = auth.uid())
  );

-- 4) Bookings kengaytmasi:
--    table_id — restoran bronida tanlangan stol
--    date_to  — dacha bronida ketish sanasi (booking_date = kelish sanasi)
alter table public.bookings
  add column if not exists table_id uuid references public.restaurant_tables(id) on delete set null;

alter table public.bookings
  add column if not exists date_to date;

create index if not exists bookings_table_idx on public.bookings (table_id);
