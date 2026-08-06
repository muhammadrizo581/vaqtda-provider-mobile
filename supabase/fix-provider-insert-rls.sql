-- ============================================================
-- fix-provider-insert-rls.sql — Mobil ilovada YANGI biznes qo'shishdagi xato.
--
-- Muammo: providers jadvalida RLS yoqilgan, lekin ustalar.sql faqat SELECT +
--   UPDATE policy qo'shgan (mobile_owner_read/update_provider). INSERT policy YO'Q.
--   Mobil ilova biznesni to'g'ridan-to'g'ri supabase.from("providers").insert()
--   bilan yaratadi → RLS rad etadi:
--     "new row violates row-level security policy for table providers"
--   Website ishlaydi, chunki u service_role (admin) ishlatadi — RLS'ni chetlaydi.
--
-- Yechim: foydalanuvchi FAQAT o'ziga (user_id = auth.uid()) biznes yarata olsin.
--
-- Xavfsizlik: additive + idempotent. Boshqasiga biznes yozib bo'lmaydi (with check).
-- Ishga tushirish: Supabase Dashboard → SQL Editor → Run.
-- ============================================================

drop policy if exists "mobile_owner_insert_provider" on public.providers;
create policy "mobile_owner_insert_provider" on public.providers
  for insert to authenticated
  with check (user_id = auth.uid());
