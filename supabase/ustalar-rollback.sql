-- ============================================================
-- ROLLBACK for ustalar.sql — mobil "ustalar" o'zgarishlarini bekor qiladi.
-- ustalar.sql qo'shgan RLS siyosatlari va provider_staff ustunlarini o'chiradi.
-- Idempotent (qayta ishga tushsa xavfsiz). Bazaning mavjud/veb siyosatlariga
-- tegmaydi — faqat "mobile_" prefiksli siyosatlar o'chadi.
-- ============================================================

-- ── RLS siyosatlarini o'chirish (ustalar.sql qo'shganlari) ───────────────────
drop policy if exists "mobile_owner_manage_staff"      on public.provider_staff;
drop policy if exists "mobile_owner_staffservices"     on public.staff_services;
drop policy if exists "public_read_active_staff"       on public.provider_staff;
drop policy if exists "public_read_staff_services"     on public.staff_services;
drop policy if exists "mobile_staff_select_self"       on public.provider_staff;
drop policy if exists "mobile_staff_update_self"       on public.provider_staff;
drop policy if exists "mobile_owner_read_provider"     on public.providers;
drop policy if exists "mobile_owner_update_provider"   on public.providers;
drop policy if exists "mobile_staff_read_provider"     on public.providers;
drop policy if exists "mobile_staff_read_services"     on public.services;
drop policy if exists "mobile_staff_read_staffservices" on public.staff_services;
drop policy if exists "mobile_staff_write_staffservices" on public.staff_services;
drop policy if exists "mobile_staff_read_bookings"     on public.bookings;
drop policy if exists "mobile_staff_update_bookings"   on public.bookings;
drop policy if exists "mobile_staff_slots_all"         on public.timetable_slots;
drop policy if exists "mobile_staff_breaks_all"        on public.timetable_breaks;

-- ── Qo'shilgan ustunlarni o'chirish ──────────────────────────────────────────
alter table public.provider_staff drop column if exists schedule_self_managed;
alter table public.provider_staff drop column if exists profile_completed;
alter table public.staff_services drop column if exists price;
alter table public.providers      drop column if exists staff_sets_own_price;
