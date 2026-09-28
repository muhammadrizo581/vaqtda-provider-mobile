-- ============================================================
-- VAQTDA: Kategoriya qoidalari (provider ilovasi bilan mos)
-- ============================================================
-- 1. Restoran va kafe/choyxona — oldindan to'lov yo'q (joyida to'lanadi).
--    Ilovada "To'lov sozlamalari" yashirildi; avval yoqilgan bo'lsa bu yerda
--    o'chiriladi, aks holda mijoz ilovasi eski qiymat bo'yicha to'lov so'raydi.
-- 2. Epilyatsiya — faqat individual (korporativ bo'lmaydi).
-- ============================================================

update public.providers
set prepayment_type = 'none'
where category_id in (select id from public.categories where slug in ('restoran', 'kafe'))
  and coalesce(prepayment_type, 'none') <> 'none';

update public.categories
set uses_staff = false
where slug = 'epilyatsiya';

update public.providers
set business_type = 'individual'
where category_id in (select id from public.categories where slug = 'epilyatsiya')
  and business_type <> 'individual';
