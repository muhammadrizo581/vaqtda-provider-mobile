-- ============================================================
-- Yangi kategoriyalar (massaj/SPA, notarius, repetitorsiz)
-- Ishga tushirish: Supabase Dashboard -> SQL Editor -> New query
-- Bir necha marta ishga tushirsa ham xavfsiz (idempotent).
-- ============================================================

-- 0) Test kategoriyalarni o'chirish (faqat hech bir provider ishlatmayotgan bo'lsa)
delete from public.categories c
where c.slug in ('masalan', 'salom')
  and not exists (select 1 from public.providers p where p.category_id = c.id);

-- ============================================================
-- 1) SLOTS — soatlik navbat (advokat kabi)
-- ============================================================

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Sartaroshxona","ru":"Барбершоп","en":"Barbershop"}'::jsonb, 'sartaroshxona', 'slots'
where not exists (select 1 from public.categories where slug = 'sartaroshxona');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Go''zallik saloni","ru":"Салон красоты","en":"Beauty salon"}'::jsonb, 'gozallik-saloni', 'slots'
where not exists (select 1 from public.categories where slug = 'gozallik-saloni');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Stomatolog","ru":"Стоматолог","en":"Dentist"}'::jsonb, 'stomatolog', 'slots'
where not exists (select 1 from public.categories where slug = 'stomatolog');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Shifokor va klinikalar","ru":"Врачи и клиники","en":"Doctors & clinics"}'::jsonb, 'klinika', 'slots'
where not exists (select 1 from public.categories where slug = 'klinika');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Psixolog","ru":"Психолог","en":"Psychologist"}'::jsonb, 'psixolog', 'slots'
where not exists (select 1 from public.categories where slug = 'psixolog');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Avtoservis va avtomoyka","ru":"Автосервис и автомойка","en":"Car service & wash"}'::jsonb, 'avtoservis', 'slots'
where not exists (select 1 from public.categories where slug = 'avtoservis');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Fotograf va fotostudiya","ru":"Фотограф и фотостудия","en":"Photographer & studio"}'::jsonb, 'fotostudiya', 'slots'
where not exists (select 1 from public.categories where slug = 'fotostudiya');

-- ============================================================
-- 2) TABLE — sana + vaqt + joy tanlash (restoran kabi,
--    restaurant_tables jadvalidan foydalanadi: stol/xona/o'rindiq)
-- ============================================================

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Kafe va choyxona","ru":"Кафе и чайхана","en":"Cafe & teahouse"}'::jsonb, 'kafe', 'table'
where not exists (select 1 from public.categories where slug = 'kafe');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Karaoke","ru":"Караоке","en":"Karaoke"}'::jsonb, 'karaoke', 'table'
where not exists (select 1 from public.categories where slug = 'karaoke');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Bilyard va bouling","ru":"Бильярд и боулинг","en":"Billiards & bowling"}'::jsonb, 'bilyard', 'table'
where not exists (select 1 from public.categories where slug = 'bilyard');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Kompyuter va PlayStation klub","ru":"Компьютерный и PlayStation клуб","en":"Gaming club"}'::jsonb, 'kompyuter-klub', 'table'
where not exists (select 1 from public.categories where slug = 'kompyuter-klub');

-- ============================================================
-- 3) DAILY — kunlik bron, kelish–ketish sanasi (dacha kabi)
-- ============================================================

insert into public.categories (name, slug, booking_mode)
select '{"uz":"To''yxona va banket zali","ru":"Тойхона и банкетный зал","en":"Wedding & banquet hall"}'::jsonb, 'toyxona', 'daily'
where not exists (select 1 from public.categories where slug = 'toyxona');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Mehmonxona va hostel","ru":"Гостиницы и хостелы","en":"Hotels & hostels"}'::jsonb, 'mehmonxona', 'daily'
where not exists (select 1 from public.categories where slug = 'mehmonxona');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Kvartira (sutkalik)","ru":"Квартиры посуточно","en":"Daily apartments"}'::jsonb, 'kvartira', 'daily'
where not exists (select 1 from public.categories where slug = 'kvartira');

insert into public.categories (name, slug, booking_mode)
select '{"uz":"Avtomobil ijarasi","ru":"Аренда автомобилей","en":"Car rental"}'::jsonb, 'avto-ijara', 'daily'
where not exists (select 1 from public.categories where slug = 'avto-ijara');

-- ============================================================
-- 4) Mavjud bo'lsa ham booking_mode ni to'g'rilab qo'yamiz
-- ============================================================

update public.categories set booking_mode = 'slots'
  where slug in ('sartaroshxona','gozallik-saloni','stomatolog','klinika','psixolog','avtoservis','fotostudiya');
update public.categories set booking_mode = 'table'
  where slug in ('kafe','karaoke','bilyard','kompyuter-klub');
update public.categories set booking_mode = 'daily'
  where slug in ('toyxona','mehmonxona','kvartira','avto-ijara');
