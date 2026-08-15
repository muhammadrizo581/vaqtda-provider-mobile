-- ============================================================
-- tolov-hisob.sql — Provayder "hisob raqami" (wallet) + to'lov kanalini
--                   (naqd/online) ajratish. BOSQICH 1.
--
-- Nima qiladi:
--   • Har provayderga UNIQUE hisob raqam beradi (masalan 997700001001).
--     Bu — ichki "hamyon" identifikatori (real bank hisobi EMAS). Barcha pul
--     platformaning yagona Click hisobiga tushadi; bu raqam faqat "bu pul aynan
--     shu provayderga tegishli" ekanini belgilaydi va statistikada ko'rsatadi.
--   • payments jadvaliga 2 ustun qo'shadi:
--       channel — 'online' (Click/Payme) yoki 'cash' (naqd, provayder qo'lida)
--       kind    — 'prepayment' (oldindan) | 'remainder' (qolgani) | 'full'
--     Naqd va online pulni ajratish SHART: naqd pul allaqachon provayderda,
--     online pul platformada turadi (keyin payout kerak bo'ladi).
--   • provider_wallet ko'rinishi (view) — hisob raqam bo'yicha yig'indilar.
--
-- Xavfsizlik: FAQAT qo'shuvchi (additive) va idempotent. Mavjud ma'lumotga
--   zarar yetkazmaydi. `enable row level security` ATAYIN chaqirilmaydi
--   (ustalar.sql dagi kabi — mijoz/veb ilovasini sindirmaslik uchun).
--
-- Ishga tushirish: Supabase Dashboard → SQL Editor → shu faylni yopishtirib Run.
-- Qayta ishga tushsa ham xavfsiz.
-- ============================================================

-- ── 1) Hisob raqam sekvensiyasi ─────────────────────────────
-- Ketma-ket, to'qnashuvsiz raqam beradi. '9977' — brend prefiksi (ixtiyoriy).
create sequence if not exists public.provider_account_seq start with 1001;

-- ── 2) providers.account_number ─────────────────────────────
alter table public.providers add column if not exists account_number text;

-- Mavjud provayderlarga (raqamsizlariga) hisob raqam beramiz
update public.providers
set account_number = '9977' || lpad(nextval('public.provider_account_seq')::text, 8, '0')
where account_number is null;

-- Unikallik kafolati
create unique index if not exists providers_account_number_uidx
  on public.providers(account_number);

-- Yangi provayder ochilganda avtomatik hisob raqam beriladi
create or replace function public.assign_provider_account_number()
returns trigger language plpgsql as $$
begin
  if new.account_number is null then
    new.account_number := '9977' || lpad(nextval('public.provider_account_seq')::text, 8, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_assign_provider_account_number on public.providers;
create trigger trg_assign_provider_account_number
  before insert on public.providers
  for each row execute function public.assign_provider_account_number();

-- ── 3) payments: naqd/online kanalini ajratish ──────────────
-- channel: 'online' (Click/Payme) | 'cash' (naqd)
-- kind:    'prepayment' | 'remainder' | 'full'
alter table public.payments add column if not exists channel text;
alter table public.payments add column if not exists kind    text;

-- method CHECK'ini kengaytiramiz: 'cash' ni ham ruxsat etamiz (asl migratsiyada
-- faqat 'payme','click' edi — naqd to'lov insert'i shusiz CHECK'ni buzardi).
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check check (method in ('payme', 'click', 'cash'));

-- Eski online to'lovlarni (channel bo'sh bo'lganini) 'online' deb belgilaymiz —
-- ular Click/Payme orqali kelgan, method ustuni bo'yicha.
update public.payments
set channel = 'online'
where channel is null and method in ('click', 'payme');

-- ── 3b) RLS: provayder o'z broni uchun NAQD to'lov yoza olsin ─
-- Bandlik yopilганda qolgan summa naqd bo'lsa, provayder payments'ga
-- cash/paid yozuv qo'shadi. RLS yoqilgan bo'lsa — bu policy SHART; yoqilmagan
-- bo'lsa — zararsiz (permissive, faqat ruxsat qo'shadi).
drop policy if exists "mobile_provider_insert_payment" on public.payments;
create policy "mobile_provider_insert_payment" on public.payments
  for insert to authenticated
  with check (provider_id in (select id from public.providers where user_id = auth.uid()));

-- Provayder o'z broni to'lovlarini o'qiy olsin (balans/qolgan summa uchun)
drop policy if exists "mobile_provider_read_payment" on public.payments;
create policy "mobile_provider_read_payment" on public.payments
  for select to authenticated
  using (provider_id in (select id from public.providers where user_id = auth.uid()));

-- ── 4) provider_wallet — hisob raqam bo'yicha yig'indilar ───
-- earned_total     — jami tushgan (naqd + online), statistika uchun
-- online_collected — platformada turgan online pul (keyin payout qilinadi)
-- cash_collected   — provayder qo'lidagi naqd pul (payout kerak emas)
-- security_invoker=on — so'rovchi (provayder) o'z RLS'i ostida ko'radi
create or replace view public.provider_wallet
with (security_invoker = on) as
select
  p.id                                                                              as provider_id,
  p.account_number,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0)                    as earned_total,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid' and pay.channel = 'online'), 0) as online_collected,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid' and pay.channel = 'cash'), 0)   as cash_collected,
  count(pay.id) filter (where pay.status = 'paid')                                   as paid_count
from public.providers p
left join public.payments pay on pay.provider_id = p.id
group by p.id, p.account_number;
