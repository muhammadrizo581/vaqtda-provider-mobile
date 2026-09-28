-- ============================================================
-- sms-otp.sql — telefon OTP kodlari va SMS jurnali.
--
-- Nega kerak: ilgari SMS kod ilovaning o'zida yaratilib, o'zida tekshirilardi,
-- Eskiz paroli esa ilova ichida edi. Endi:
--   • send-sms-otp  — kodni SERVERDA yaratadi, hash'ini phone_otps ga yozadi
--   • provider-register — kodni shu jadvaldan tekshiradi
--   • sms_log — bitta bron / navbat yozuvi uchun SMS faqat BIR MARTA ketadi
--
-- Ikkala jadvalda RLS yoqilgan va siyosat YO'Q — faqat service_role (Edge
-- Function) o'qiydi/yozadi, ilova to'g'ridan-to'g'ri ko'ra olmaydi.
--
-- Ishga tushirish: Supabase Dashboard → SQL Editor → Run. Idempotent.
-- ============================================================

create table if not exists public.phone_otps (
  phone      text primary key,          -- "998901234567"
  code_hash  text not null,
  attempts   integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.phone_otps enable row level security;

create table if not exists public.sms_log (
  id         bigserial primary key,
  kind       text not null,             -- booking_cancelled | waitlist_slot_opened
  ref_id     uuid not null,             -- bookings.id / waitlist.id
  phone      text not null,
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);
alter table public.sms_log enable row level security;
