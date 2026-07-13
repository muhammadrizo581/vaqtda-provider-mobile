-- ─────────────────────────────────────────────────────────────────────────────
-- Mobil ilova uchun RLS siyosatlari.
--
-- Nega kerak: veb-saytda provayderning bronlari va navbati server API orqali
-- (service_role kaliti bilan) o'qilardi. Mobil ilova Supabase'ga to'g'ridan-
-- to'g'ri ulanadi, shuning uchun provayderga O'ZINING ma'lumotlarini o'qishga
-- ruxsat beruvchi siyosatlar kerak.
--
-- Qanday ishlatish: Supabase Dashboard → SQL Editor → shu faylni yopishtirib
-- Run bosing. Agar ilovada bronlar/navbat bo'sh ko'rinsa — aynan shu kerak.
-- ─────────────────────────────────────────────────────────────────────────────

-- Provayder o'z bronlarini ko'ra oladi
create policy "provider_read_own_bookings"
on public.bookings for select
to authenticated
using (
  provider_id in (select id from public.providers where user_id = auth.uid())
);

-- Provayder o'z bronlarining holatini o'zgartira oladi (bekor qilish/yakunlash)
create policy "provider_update_own_bookings"
on public.bookings for update
to authenticated
using (
  provider_id in (select id from public.providers where user_id = auth.uid())
)
with check (
  provider_id in (select id from public.providers where user_id = auth.uid())
);

-- Provayder o'z navbat (waitlist) yozuvlarini ko'ra oladi
create policy "provider_read_own_waitlist"
on public.waitlist for select
to authenticated
using (
  provider_id in (select id from public.providers where user_id = auth.uid())
);

-- Provayder o'ziga bron qilgan / navbatda turgan mijozlarning profilini
-- (ism, telefon, avatar) ko'ra oladi
create policy "provider_read_client_profiles"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or id in (
    select b.client_id from public.bookings b
    where b.provider_id in (select id from public.providers where user_id = auth.uid())
  )
  or id in (
    select w.client_id from public.waitlist w
    where w.provider_id in (select id from public.providers where user_id = auth.uid())
  )
);
