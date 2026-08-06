-- ============================================================
-- click-debug-va-reconcile.sql
--   1) click_debug jadvali — webhook har Click chaqiruvini shu yerga yozadi
--      (remainder Complete nega ishlamayotganini aniqlash uchun. Vaqtinchalik).
--   2) Hozirgi stuck bronlarni to'g'rilash (pul Click'da tasdiqlangan).
-- Supabase Dashboard → SQL Editor → Run.
-- ============================================================

-- ── 1) Diagnostika jadvali ──────────────────────────────────
create table if not exists public.click_debug (
  id                  bigserial primary key,
  at                  timestamptz not null default now(),
  action              text,   -- "0"=Prepare, "1"=Complete
  merchant_trans_id   text,   -- "<bookingId>" yoki "<bookingId>__R"
  amount              text,
  merchant_prepare_id text,
  sign_time           text,
  click_error         text,
  is_remainder        boolean,
  sign_ok             boolean,
  note                text
);
-- Service_role yozadi (webhook). Read uchun cheklov shart emas — vaqtinchalik.

-- ── 2) Stuck bronlarni to'g'rilash (pul tasdiqlangan) ───────
-- Booking 3f358388 — remainder to'landi (Click: "To'lov amalga oshirildi")
update public.payments set status='paid', paid_at=now()
where id='8a603409-b3a4-4a3e-aca1-4565570d03af' and status <> 'paid';

-- Booking 25694be0 — bitta remainder paid, dublikat urinish cancelled
update public.payments set status='paid', paid_at=now()
where id='a0c6142b-dece-4ebc-9ca1-8c449b2ab18b' and status <> 'paid';
update public.payments set status='cancelled'
where id='9e116d31-4d98-4dae-84fc-5fde4f9eda52' and status = 'created';

-- Ikkala bronni yopamiz (to'liq to'langan)
update public.bookings set status='completed'
where id in ('3f358388-798b-48a9-8111-559d4e9384f0',
             '25694be0-25ce-48fc-a1e3-83ec2638da63')
  and status <> 'completed';
