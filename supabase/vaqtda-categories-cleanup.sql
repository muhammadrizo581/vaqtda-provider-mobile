-- ============================================================
-- VAQTDA: Kategoriyalar va Yangi Biznes Strukturasi Migratsiyasi
-- ============================================================
-- Ushbu skript:
-- 1. Keraksiz 7 ta kategoriyani tozalaydi
-- 2. Qolgan 17 ta kategoriyani to'g'ri booking_mode va bayroqlar bilan yangilaydi
-- 3. providers jadvaliga business_type ('corporate' / 'individual') ustunini qo'shadi
-- 4. Mehmonxonalar uchun hotel_rooms jadvalini yaratadi
-- 5. Avto-ijara uchun rental_cars jadvalini yaratadi
-- 6. RLS xavfsizlik qoidalarini o'rnatadi
-- ============================================================

-- ------------------------------------------------------------
-- 1. Keraksiz 7 ta kategoriyani tozalash
-- ------------------------------------------------------------
update public.providers
set category_id = null
where category_id in (
  select id from public.categories
  where slug in ('kiprik-qosh', 'karaoke', 'bilyard', 'kompyuter-klub', 'avtoservis', 'detailing', 'tonirovka')
);

delete from public.categories
where slug in ('kiprik-qosh', 'karaoke', 'bilyard', 'kompyuter-klub', 'avtoservis', 'detailing', 'tonirovka');

-- ------------------------------------------------------------
-- 2. Qolgan 17 ta kategoriyani kiritish va yangilash
-- ------------------------------------------------------------
alter table public.categories
  add column if not exists booking_mode text not null default 'slots';

alter table public.categories
  add column if not exists uses_departments boolean not null default false;

alter table public.categories
  add column if not exists uses_staff boolean not null default false;

-- A) SLOTS — Vaqt bo'yicha
insert into public.categories (name, slug, booking_mode, uses_departments, uses_staff)
values
  ('{"uz":"Sartaroshxona","ru":"Барбершоп","en":"Barbershop"}'::jsonb, 'sartaroshxona', 'slots', false, true),
  ('{"uz":"Go''zallik saloni","ru":"Салон красоты","en":"Beauty salon"}'::jsonb, 'gozallik-saloni', 'slots', false, true),
  ('{"uz":"Tirnoq servisi","ru":"Ногтевой сервис","en":"Nail service"}'::jsonb, 'tirnoq', 'slots', false, true),
  ('{"uz":"Kosmetolog","ru":"Косметолог","en":"Cosmetologist"}'::jsonb, 'kosmetolog', 'slots', false, true),
  ('{"uz":"Epilyatsiya","ru":"Эпиляция","en":"Epilation"}'::jsonb, 'epilyatsiya', 'slots', false, false),
  ('{"uz":"Shifokor va klinikalar","ru":"Врачи и клиники","en":"Doctors & clinics"}'::jsonb, 'klinika', 'slots', true, true),
  ('{"uz":"Stomatologiya","ru":"Стоматология","en":"Dentistry"}'::jsonb, 'stomatolog', 'slots', false, false),
  ('{"uz":"Fotograf va fotostudiya","ru":"Фотограф и фотостудия","en":"Photographer & studio"}'::jsonb, 'fotostudiya', 'slots', false, false),
  ('{"uz":"Psixolog","ru":"Психолог","en":"Psychologist"}'::jsonb, 'psixolog', 'slots', false, false),
  ('{"uz":"Avtomoyka","ru":"Автомойка","en":"Car wash"}'::jsonb, 'avtomoyka', 'slots', false, true)
on conflict (slug) do update set
  name = excluded.name,
  booking_mode = excluded.booking_mode,
  uses_departments = excluded.uses_departments,
  uses_staff = excluded.uses_staff;

-- B) TABLE — Stol va xonalar (Restoran, Kafe)
insert into public.categories (name, slug, booking_mode, uses_departments, uses_staff)
values
  ('{"uz":"Restoran","ru":"Ресторан","en":"Restaurant"}'::jsonb, 'restoran', 'table', false, false),
  ('{"uz":"Kafe va choyxona","ru":"Кафе и чайхана","en":"Cafe & teahouse"}'::jsonb, 'kafe', 'table', false, false)
on conflict (slug) do update set
  name = excluded.name,
  booking_mode = excluded.booking_mode,
  uses_departments = excluded.uses_departments,
  uses_staff = excluded.uses_staff;

-- C) DAILY — Kunlik va sutkalik
insert into public.categories (name, slug, booking_mode, uses_departments, uses_staff)
values
  ('{"uz":"Dacha va villalar","ru":"Дачи и виллы","en":"Cottages & villas"}'::jsonb, 'dacha', 'daily', false, false),
  ('{"uz":"Kvartira (sutkalik)","ru":"Квартиры посуточно","en":"Daily apartments"}'::jsonb, 'kvartira', 'daily', false, false),
  ('{"uz":"Mehmonxona va hostel","ru":"Гостиницы и хостелы","en":"Hotels & hostels"}'::jsonb, 'mehmonxona', 'daily', false, false),
  ('{"uz":"To''yxona va banket zali","ru":"Тойхона и банкетный зал","en":"Wedding & banquet hall"}'::jsonb, 'toyxona', 'daily', false, false),
  ('{"uz":"Avtomobil ijarasi","ru":"Аренда автомобилей","en":"Car rental"}'::jsonb, 'avto-ijara', 'daily', false, false)
on conflict (slug) do update set
  name = excluded.name,
  booking_mode = excluded.booking_mode,
  uses_departments = excluded.uses_departments,
  uses_staff = excluded.uses_staff;

-- ------------------------------------------------------------
-- 3. providers jadvaliga business_type qo'shish
-- ------------------------------------------------------------
alter table public.providers
  add column if not exists business_type text not null default 'corporate';

alter table public.providers
  drop constraint if exists providers_business_type_check;
alter table public.providers
  add constraint providers_business_type_check
  check (business_type in ('corporate', 'individual'));

-- ------------------------------------------------------------
-- 4. Mehmonxona Xonalari jadvali (hotel_rooms)
-- ------------------------------------------------------------
create table if not exists public.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name text not null,
  room_type text not null default 'standard',
  capacity integer not null default 2 check (capacity > 0),
  price_per_night numeric(12, 2) not null default 0 check (price_per_night >= 0),
  description text,
  amenities text[] default '{}',
  images text[] default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_rooms_provider_idx on public.hotel_rooms(provider_id);

alter table public.hotel_rooms enable row level security;

drop policy if exists "hotel_rooms_select_all" on public.hotel_rooms;
create policy "hotel_rooms_select_all" on public.hotel_rooms
  for select using (true);

drop policy if exists "hotel_rooms_manage_own" on public.hotel_rooms;
create policy "hotel_rooms_manage_own" on public.hotel_rooms
  for all using (
    exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5. Avto-ijara Mashinalari jadvali (rental_cars)
-- ------------------------------------------------------------
create table if not exists public.rental_cars (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  brand text not null,
  model text not null,
  year integer check (year >= 1990 and year <= 2035),
  transmission text not null default 'automatic',
  fuel_type text not null default 'petrol',
  daily_price numeric(12, 2) not null default 0 check (daily_price >= 0),
  color text,
  plate_number text,
  deposit_amount numeric(12, 2) default 0,
  images text[] default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_cars_provider_idx on public.rental_cars(provider_id);

alter table public.rental_cars enable row level security;

drop policy if exists "rental_cars_select_all" on public.rental_cars;
create policy "rental_cars_select_all" on public.rental_cars
  for select using (true);

drop policy if exists "rental_cars_manage_own" on public.rental_cars;
create policy "rental_cars_manage_own" on public.rental_cars
  for all using (
    exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 6. Bookings jadvalini kengaytirish
-- ------------------------------------------------------------
alter table public.bookings
  add column if not exists room_id uuid references public.hotel_rooms(id) on delete set null;

alter table public.bookings
  add column if not exists car_id uuid references public.rental_cars(id) on delete set null;

create index if not exists bookings_room_idx on public.bookings(room_id);
create index if not exists bookings_car_idx on public.bookings(car_id);
