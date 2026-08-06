-- ============================================================
-- fix-cash-settle.sql — Naqd to'lov bilan bandlik yopishdagi "Saqlab bo'lmadi".
--
-- Naqd oqim (mobil settleCashAndComplete): (1) payments'ga cash yozadi,
--   (2) act('complete') bronni 'completed' qiladi. Bittasi RLS/constraint'da
--   fail bo'lsa "Saqlab bo'lmadi" chiqadi.
--
-- Bu skript BARCHA shartlarni qayta ta'minlaydi (idempotent, additive):
--   • payments.channel/kind ustunlari
--   • method CHECK 'cash' ni ruxsat etadi
--   • payments INSERT/SELECT — provayder o'z broni uchun (RLS)
--   • bookings UPDATE — OWNER o'z bronini yakunlay/bekor qila olsin (RLS)  ← ehtimoliy sabab
--
-- Ishga tushirish: Supabase Dashboard → SQL Editor → Run.
-- ============================================================

-- ── 1) payments ustunlari + method CHECK ────────────────────
alter table public.payments add column if not exists channel text;
alter table public.payments add column if not exists kind    text;

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check check (method in ('payme', 'click', 'cash'));

-- ── 2) payments RLS: provayder o'z broni to'lovini yozadi/o'qiydi ─
drop policy if exists "mobile_provider_insert_payment" on public.payments;
create policy "mobile_provider_insert_payment" on public.payments
  for insert to authenticated
  with check (provider_id in (select id from public.providers where user_id = auth.uid()));

drop policy if exists "mobile_provider_read_payment" on public.payments;
create policy "mobile_provider_read_payment" on public.payments
  for select to authenticated
  using (provider_id in (select id from public.providers where user_id = auth.uid()));

-- ── 3) bookings RLS: OWNER o'z bronini yakunlaydi/bekor qiladi ──
-- ustalar.sql faqat STAFF uchun update policy qo'shgan; owner uchun yo'q edi.
-- act('complete'/'cancel') shu policy'siz RLS'da fail bo'ladi → "Saqlab bo'lmadi".
drop policy if exists "mobile_owner_update_bookings" on public.bookings;
create policy "mobile_owner_update_bookings" on public.bookings
  for update to authenticated
  using      (provider_id in (select id from public.providers where user_id = auth.uid()))
  with check (provider_id in (select id from public.providers where user_id = auth.uid()));

drop policy if exists "mobile_owner_read_bookings" on public.bookings;
create policy "mobile_owner_read_bookings" on public.bookings
  for select to authenticated
  using (provider_id in (select id from public.providers where user_id = auth.uid()));
