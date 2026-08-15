-- ============================================================
-- ustalar.sql — Sartaroshxona/go'zallik saloni "ustalar" (workerlar) funksiyasi.
--
-- Nima qiladi:
--   • Owner biznesiga ustalarni qo'shadi (login+parol create-worker Edge Function
--     orqali). Usta shu login bilan kirib, o'z profilini va qaysi xizmatlarni
--     bajarishini (staff_services) o'zi belgilaydi.
--   • Narx modeli — bitta owner tugmasi (providers.staff_sets_own_price):
--       false (default) → butun do'kon uchun umumiy narx (services.price, owner belgilaydi)
--       true            → har bir usta o'z narxini qo'yadi (staff_services.price;
--                         bo'sh bo'lsa → services.price ga qaytadi)
--   • Usta qo'shmasa — owner yolg'iz ishlaydi (bookings.staff_id = null), muammosiz.
--
-- Xavfsizlik: FAQAT qo'shuvchi (additive) va idempotent — mavjud yagona sartaroshga
--   yoki mijoz ilovasiga zarar yetkazmaydi. `add column if not exists`, uses_staff
--   yangilash, va `drop policy if exists` + `create policy` (permissive siyosatlar
--   faqat ruxsat QO'SHADI, hech qачон cheklamaydi). `enable row level security`
--   ATAYIN chaqirilmaydi (pastdagi izohga qarang).
--
-- Ishga tushirish: Supabase Dashboard → SQL Editor → shu faylni yopishtirib Run.
-- Qayta ishga tushsa ham xavfsiz. Bekor qilish: ustalar-rollback.sql.
-- ============================================================

-- ── 1) provider_staff ustunlari ─────────────────────────────
alter table public.provider_staff add column if not exists schedule_self_managed boolean not null default false;
alter table public.provider_staff add column if not exists profile_completed     boolean not null default false;
-- Yangi usta darhol aktiv bo'lsin
alter table public.provider_staff alter column is_active set default true;

-- ── 2) Narx modeli ──────────────────────────────────────────
-- Owner tugmasi: ustalar o'z narxini belgilaydimi?
alter table public.providers      add column if not exists staff_sets_own_price boolean not null default false;
-- Har bir usta o'z xizmatiga narx (null → do'konning services.price)
alter table public.staff_services add column if not exists price numeric;

-- ── 3) uses_staff bayrog'i + yoqish ─────────────────────────
alter table public.categories add column if not exists uses_staff boolean not null default false;
update public.categories set uses_staff = true where slug in ('sartaroshxona','gozallik-saloni');

-- ── 4) RLS: provider_staff (owner boshqaradi, usta o'zini o'qiydi/tahrirlaydi) ─
drop policy if exists "mobile_owner_manage_staff" on public.provider_staff;
create policy "mobile_owner_manage_staff" on public.provider_staff
  for all to authenticated
  using      (provider_id in (select id from public.providers where user_id = auth.uid()))
  with check (provider_id in (select id from public.providers where user_id = auth.uid()));

drop policy if exists "mobile_staff_select_self" on public.provider_staff;
create policy "mobile_staff_select_self" on public.provider_staff
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "mobile_staff_update_self" on public.provider_staff;
create policy "mobile_staff_update_self" on public.provider_staff
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 5) RLS: staff_services (owner + usta narxni yozadi) ─────
drop policy if exists "mobile_owner_staffservices" on public.staff_services;
create policy "mobile_owner_staffservices" on public.staff_services
  for all to authenticated
  using      (staff_id in (select ps.id from public.provider_staff ps
                           join public.providers p on p.id = ps.provider_id
                           where p.user_id = auth.uid()))
  with check (staff_id in (select ps.id from public.provider_staff ps
                           join public.providers p on p.id = ps.provider_id
                           where p.user_id = auth.uid()));

drop policy if exists "mobile_staff_read_staffservices" on public.staff_services;
create policy "mobile_staff_read_staffservices" on public.staff_services
  for select to authenticated
  using (staff_id in (select id from public.provider_staff where user_id = auth.uid()));

drop policy if exists "mobile_staff_write_staffservices" on public.staff_services;
create policy "mobile_staff_write_staffservices" on public.staff_services
  for all to authenticated
  using      (staff_id in (select id from public.provider_staff where user_id = auth.uid()))
  with check (staff_id in (select id from public.provider_staff where user_id = auth.uid()));

-- ── 6) RLS: OWNER o'z biznesini o'qiy/tahrirlay olsin ───────
-- MUHIM: providers da RLS yoqilgach owner o'z yozuvini o'qiy olishi uchun shu
-- siyosat SHART. Bo'lmasa dashboard (web + mobil) "Biznes topilmadi" deydi,
-- garchi yozuv mavjud bo'lsa ham.
drop policy if exists "mobile_owner_read_provider" on public.providers;
create policy "mobile_owner_read_provider" on public.providers
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "mobile_owner_update_provider" on public.providers;
create policy "mobile_owner_update_provider" on public.providers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Usta ham o'zi ishlaydigan do'konni ko'radi
drop policy if exists "mobile_staff_read_provider" on public.providers;
create policy "mobile_staff_read_provider" on public.providers
  for select to authenticated
  using (id in (select provider_id from public.provider_staff where user_id = auth.uid()));

drop policy if exists "mobile_staff_read_services" on public.services;
create policy "mobile_staff_read_services" on public.services
  for select to authenticated
  using (provider_id in (select provider_id from public.provider_staff where user_id = auth.uid()));

drop policy if exists "mobile_staff_read_bookings" on public.bookings;
create policy "mobile_staff_read_bookings" on public.bookings
  for select to authenticated
  using (staff_id in (select id from public.provider_staff where user_id = auth.uid()));

drop policy if exists "mobile_staff_update_bookings" on public.bookings;
create policy "mobile_staff_update_bookings" on public.bookings
  for update to authenticated
  using      (staff_id in (select id from public.provider_staff where user_id = auth.uid()))
  with check (staff_id in (select id from public.provider_staff where user_id = auth.uid()));

-- ── 7) RLS: usta jadval (timetable) ni ko'radi ──────────────
drop policy if exists "mobile_staff_slots_all" on public.timetable_slots;
create policy "mobile_staff_slots_all" on public.timetable_slots
  for select to authenticated
  using (provider_id in (select provider_id from public.provider_staff where user_id = auth.uid()));

drop policy if exists "mobile_staff_breaks_all" on public.timetable_breaks;
create policy "mobile_staff_breaks_all" on public.timetable_breaks
  for select to authenticated
  using (provider_id in (select provider_id from public.provider_staff where user_id = auth.uid()));

-- ── 8) RLS: MIJOZLAR (anon + authenticated) ustalarni ko'radi ─
-- Mijoz do'kon sahifasida usta tanlaydi → usta xizmatlari/narxini ko'radi.
-- Shuning uchun ommaviy (anon + authenticated) o'qish siyosati SHART. Aks holda
-- Booking/vaqtda-mobile'da usta ro'yxati bo'sh chiqadi.
drop policy if exists "public_read_active_staff" on public.provider_staff;
create policy "public_read_active_staff" on public.provider_staff
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "public_read_staff_services" on public.staff_services;
create policy "public_read_staff_services" on public.staff_services
  for select to anon, authenticated
  using (true);

-- ── RLS IZOHI ───────────────────────────────────────────────
-- `enable row level security` ATAYIN chaqirilmaydi: funksiya hozir ishlayapti,
-- demak bu jadvallarda RLS allaqachon yoqilgan va siyosatlar amal qiladi. Agar
-- biror jadval hozir ochiq bo'lsa, RLS ni yoqib qo'yish mijoz/veb ilovasi anon
-- kalit bilan provider_staff/staff_services ni o'qisa — sindirishi mumkin. Shuning
-- uchun skript faqat qo'shuvchi (additive) qilib qoldirildi. Kerak bo'lsa keyin
-- alohida yoqamiz.
