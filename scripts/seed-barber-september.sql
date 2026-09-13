-- ============================================================================
-- BarberOne (smth7019@gmail.com / hisob: 997700001008) uchun Sentyabr 2026
-- to'liq demo ma'lumotlari.
--
-- Boshqaruv (Dashboard) ekrani to'liq, chiroyli va real statistikalar bilan to'ladi:
--   • Bugungi daromad (565 000 so'm, 6 ta bron)
--   • Kelgusi bronlar (9 ta)
--   • Faol navbat (2 ta)
--   • HISOBIM (997700001008: Jami ~4.7 mln, Online ~2.6 mln, Naqd ~2.1 mln)
--   • Statistika: BU OY (~4.7 mln so'm, ~15 mijoz, ~50 bron, Bekor qilish ~4%)
--   • Bugungi bandlik (~60%)
--   • Rekord kun: 10-sentabr (680 000 so'm)
--   • 7 kunlik daromad grafigi (7-13 sentabr, barcha ustunlar baland va faol)
--   • Bugungi bronlar va keyingi bron kartasi
-- ============================================================================

do $seed_barber$
declare
  v_pid         uuid := '3bd3b9a8-ccc2-41a7-b850-8dc7f1353f9c';
  v_today       date := date '2026-09-13';
  v_now         time := time '14:00';
  v_client_names text[] := array[
    'Jasur Rahimov', 'Bobur Mirzayev', 'Ulug''bek Yusupov', 'Bekzod Qodirov',
    'Farhod Alimov', 'Sanjar Norov', 'Sherzod Toirov', 'Rustam Hakimov',
    'Shohruh Nazarov', 'Jahongir Olimov', 'Doniyor Ergashev', 'Otabek Ziyayev',
    'Akmal G''aniyev', 'Dilshod Shukurov', 'Ibrohim Boltayev'
  ];
  v_client_phones text[] := array[
    '+998 90 123 45 67', '+998 91 234 56 78', '+998 93 345 67 89', '+998 94 456 78 90',
    '+998 97 567 89 01', '+998 99 678 90 12', '+998 90 789 01 23', '+998 93 890 12 34',
    '+998 94 901 23 45', '+998 97 012 34 56', '+998 99 123 45 67', '+998 90 234 56 78',
    '+998 91 345 67 89', '+998 93 456 78 90', '+998 94 567 89 01'
  ];
  v_client_ids  uuid[] := '{}';
  v_cid         uuid;
  v_s1          uuid;
  v_s2          uuid;
  v_s3          uuid;
  v_s4          uuid;
  v_s5          uuid;
  v_bk_id       uuid;
  j             int;
begin
  -- 1) Provider profilini yangilash
  update public.providers
     set business_name = 'BarberOne',
         rating = 4.95,
         reviews_count = 42,
         about = '{"uz": "Zamonaviy erkaklar sartaroshxonasi. Premium sifat, tajribali ustalar va qulay muhit.", "ru": "Современный барбершоп", "en": "Modern barbershop"}'::jsonb,
         is_active = true,
         schedule_mode = 'shared'
   where id = v_pid;

  -- 2) Demo mijozlar profillarini yangilash (auth.users da mavjud IDlar)
  v_client_ids := array[
    'e2ddae45-4b5e-4cf7-9280-5516eeb0560a'::uuid, -- Jasur Rahimov
    '7e1d5de4-8430-4e03-87c8-900ffcba3ff4'::uuid, -- Bobur Mirzayev
    '68772b4f-62c8-48e6-8f3f-8e7aa7b8c034'::uuid, -- Ulug'bek Yusupov
    '4ac1da30-654e-4b11-81df-c719a4da8122'::uuid, -- Bekzod Qodirov
    'b0afa1db-5710-440f-a2cd-0952eadb245d'::uuid, -- Farhod Alimov
    'f7d51b34-7754-4391-b362-1e792a529d1c'::uuid, -- Sanjar Norov
    '850b1a34-a4d2-4f77-be6c-5eb6d6a2508b'::uuid, -- Sherzod Toirov
    '97464920-14dd-4eb0-9784-8330d3405759'::uuid, -- Rustam Hakimov
    'dd8275bb-468c-4bf2-b2fc-7e5ae4517fd3'::uuid, -- Shohruh Nazarov
    'df2b4ff4-2c4f-40c7-a20c-c44c54bd2e8b'::uuid, -- Jahongir Olimov
    'deaf5ab5-777b-4a39-9475-ddd84de15653'::uuid, -- Doniyor Ergashev
    'b92b9aa9-66ef-4ec1-85c1-95a172749133'::uuid, -- Otabek Ziyayev
    '814a90a0-3296-4577-9177-cc05e87fcfa1'::uuid, -- Akmal G'aniyev
    '2fa82e1c-d389-4e49-86f0-ef46beac6dee'::uuid, -- Dilshod Shukurov
    '25d487b5-f4c7-43cb-ab06-42ab1a5d2a96'::uuid  -- Ibrohim Boltayev
  ];

  for j in 1..array_length(v_client_ids, 1) loop
    insert into public.profiles (id, full_name, phone, role)
    values (v_client_ids[j], v_client_names[j], v_client_phones[j], 'client')
    on conflict (id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        role = 'client';
  end loop;

  -- 3) Xizmatlar (services)
  select id into v_s1 from public.services where provider_id = v_pid and name->>'uz' = 'Erkaklar soch turmagi (Fade / Classic)' limit 1;
  if v_s1 is null then
    v_s1 := gen_random_uuid();
    insert into public.services (id, provider_id, name, description, price, duration_minutes, is_active, sort_order)
    values (v_s1, v_pid, '{"uz":"Erkaklar soch turmagi (Fade / Classic)","ru":"Мужская стрижка","en":"Men haircut"}'::jsonb,
            '{"uz":"Soch yuvish va individual uslub tanlash bilan"}'::jsonb, 80000, 45, true, 0);
  end if;

  select id into v_s2 from public.services where provider_id = v_pid and name->>'uz' = 'Soqol olish va shakl berish' limit 1;
  if v_s2 is null then
    v_s2 := gen_random_uuid();
    insert into public.services (id, provider_id, name, description, price, duration_minutes, is_active, sort_order)
    values (v_s2, v_pid, '{"uz":"Soqol olish va shakl berish","ru":"Стрижка бороды","en":"Beard trim"}'::jsonb,
            '{"uz":"Issiq sochiq va maxsus moy bilan parvarish"}'::jsonb, 45000, 30, true, 1);
  end if;

  select id into v_s3 from public.services where provider_id = v_pid and name->>'uz' = 'VIP Kompleks (Soch + Soqol + Niqob)' limit 1;
  if v_s3 is null then
    v_s3 := gen_random_uuid();
    insert into public.services (id, provider_id, name, description, price, duration_minutes, is_active, sort_order)
    values (v_s3, v_pid, '{"uz":"VIP Kompleks (Soch + Soqol + Niqob)","ru":"VIP Комплекс","en":"VIP Complex"}'::jsonb,
            '{"uz":"Soch turmagi, soqol dizayni, yuz massaji va qora niqob"}'::jsonb, 150000, 60, true, 2);
  end if;

  select id into v_s4 from public.services where provider_id = v_pid and name->>'uz' = 'Bolalar soch turmagi' limit 1;
  if v_s4 is null then
    v_s4 := gen_random_uuid();
    insert into public.services (id, provider_id, name, description, price, duration_minutes, is_active, sort_order)
    values (v_s4, v_pid, '{"uz":"Bolalar soch turmagi","ru":"Детская стрижка","en":"Kids haircut"}'::jsonb,
            '{"uz":"10 yoshgacha bo''lgan bolalar uchun"}'::jsonb, 60000, 35, true, 3);
  end if;

  select id into v_s5 from public.services where provider_id = v_pid and name->>'uz' = 'Soch yuvish va styling' limit 1;
  if v_s5 is null then
    v_s5 := gen_random_uuid();
    insert into public.services (id, provider_id, name, description, price, duration_minutes, is_active, sort_order)
    values (v_s5, v_pid, '{"uz":"Soch yuvish va styling","ru":"Мытье и укладка","en":"Wash & styling"}'::jsonb,
            '{"uz":"Premium shampun va fiksatsiya vositalari"}'::jsonb, 35000, 20, true, 4);
  end if;

  -- 4) Timetable slots (Sentyabr oyi uchun har kuni 09:00 - 21:00 ochiq ish jadvali)
  delete from public.timetable_slots where provider_id = v_pid and slot_date between date '2026-09-01' and date '2026-09-30';
  insert into public.timetable_slots (provider_id, slot_date, start_time, end_time, is_available)
  select v_pid, d::date, '09:00', '21:00', true
    from generate_series(date '2026-09-01', date '2026-09-30', interval '1 day') as d;

  -- 5) Mavjud Sentyabr bronlari va to'lovlarini tozalash (idempotent qayta yuklash)
  delete from public.payments where provider_id = v_pid and created_at between '2026-09-01 00:00:00+00' and '2026-09-30 23:59:59+00';
  delete from public.bookings where provider_id = v_pid and booking_date between date '2026-09-01' and date '2026-09-30';
  delete from public.waitlist where provider_id = v_pid;

  -- 6) Bronlar va To'lovlarni qo'shish

  -- ── 1-sentabr (Dushanba): 3 ta yakunlangan (~240 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[1], v_s1, '2026-09-01', '10:00', '10:45', 45, 'completed', 80000, '2026-09-01 08:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[2], v_s2, '2026-09-01', '12:00', '12:30', 30, 'completed', 45000, '2026-09-01 09:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[3], v_s3, '2026-09-01', '15:00', '16:00', 60, 'completed', 150000, '2026-09-01 11:00:00+05');

  -- ── 2-sentabr: 4 ta yakunlangan (~310 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[4], v_s1, '2026-09-02', '10:30', '11:15', 45, 'completed', 80000, '2026-09-02 08:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[5], v_s4, '2026-09-02', '12:30', '13:05', 35, 'completed', 60000, '2026-09-02 09:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[6], v_s2, '2026-09-02', '14:30', '15:00', 30, 'completed', 45000, '2026-09-02 11:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[7], v_s3, '2026-09-02', '17:00', '18:00', 60, 'completed', 150000, '2026-09-02 13:00:00+05');

  -- ── 3-sentabr: 4 ta yakunlangan (~355 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[8], v_s1, '2026-09-03', '09:30', '10:15', 45, 'completed', 80000, '2026-09-03 08:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[9], v_s1, '2026-09-03', '11:30', '12:15', 45, 'completed', 80000, '2026-09-03 09:10:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[10], v_s2, '2026-09-03', '14:00', '14:30', 30, 'completed', 45000, '2026-09-03 10:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[1], v_s3, '2026-09-03', '16:30', '17:30', 60, 'completed', 150000, '2026-09-03 12:00:00+05');

  -- ── 4-sentabr: 3 ta yakunlangan (~275 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[2], v_s1, '2026-09-04', '10:00', '10:45', 45, 'completed', 80000, '2026-09-04 08:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[3], v_s2, '2026-09-04', '12:00', '12:30', 30, 'completed', 45000, '2026-09-04 09:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[4], v_s3, '2026-09-04', '15:30', '16:30', 60, 'completed', 150000, '2026-09-04 11:30:00+05');

  -- ── 5-sentabr: 5 ta yakunlangan (~420 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[5], v_s1, '2026-09-05', '09:30', '10:15', 45, 'completed', 80000, '2026-09-05 08:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[6], v_s2, '2026-09-05', '11:00', '11:30', 30, 'completed', 45000, '2026-09-05 09:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[7], v_s4, '2026-09-05', '13:00', '13:35', 35, 'completed', 60000, '2026-09-05 10:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[8], v_s1, '2026-09-05', '15:00', '15:45', 45, 'completed', 80000, '2026-09-05 12:10:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[9], v_s3, '2026-09-05', '17:00', '18:00', 60, 'completed', 150000, '2026-09-05 13:30:00+05');

  -- ── 6-sentabr: 4 yakunlangan, 1 bekor qilingan (~305 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[10], v_s1, '2026-09-06', '10:00', '10:45', 45, 'completed', 80000, '2026-09-06 08:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[11], v_s2, '2026-09-06', '11:30', '12:00', 30, 'completed', 45000, '2026-09-06 09:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[12], v_s5, '2026-09-06', '13:00', '13:20', 20, 'cancelled', 35000, '2026-09-06 10:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[13], v_s3, '2026-09-06', '15:00', '16:00', 60, 'completed', 150000, '2026-09-06 11:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[14], v_s2, '2026-09-06', '17:30', '18:00', 30, 'completed', 45000, '2026-09-06 14:00:00+05');

  -- ── 7-sentabr (7 kunlik grafik boshlanishi): 4 ta (~320 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[1], v_s1, '2026-09-07', '09:30', '10:15', 45, 'completed', 80000, '2026-09-07 08:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[2], v_s2, '2026-09-07', '11:15', '11:45', 30, 'completed', 45000, '2026-09-07 09:10:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[3], v_s4, '2026-09-07', '13:30', '14:05', 35, 'completed', 60000, '2026-09-07 10:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[4], v_s3, '2026-09-07', '16:00', '17:00', 60, 'completed', 150000, '2026-09-07 12:00:00+05');

  -- ── 8-sentabr: 5 ta (~410 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[5], v_s1, '2026-09-08', '10:00', '10:45', 45, 'completed', 80000, '2026-09-08 08:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[6], v_s2, '2026-09-08', '11:30', '12:00', 30, 'completed', 45000, '2026-09-08 09:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[7], v_s1, '2026-09-08', '13:30', '14:15', 45, 'completed', 80000, '2026-09-08 10:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[8], v_s5, '2026-09-08', '15:15', '15:35', 20, 'completed', 35000, '2026-09-08 12:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[9], v_s3, '2026-09-08', '17:00', '18:00', 60, 'completed', 150000, '2026-09-08 13:40:00+05');

  -- ── 9-sentabr: 4 ta (~355 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[10], v_s1, '2026-09-09', '10:15', '11:00', 45, 'completed', 80000, '2026-09-09 08:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[11], v_s1, '2026-09-09', '12:00', '12:45', 45, 'completed', 80000, '2026-09-09 09:50:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[12], v_s2, '2026-09-09', '14:15', '14:45', 30, 'completed', 45000, '2026-09-09 11:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[13], v_s3, '2026-09-09', '16:30', '17:30', 60, 'completed', 150000, '2026-09-09 12:50:00+05');

  -- ── 10-sentabr: REKORD KUN! 7 ta (~680 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[14], v_s1, '2026-09-10', '09:00', '09:45', 45, 'completed', 80000, '2026-09-10 07:45:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[1], v_s3, '2026-09-10', '10:15', '11:15', 60, 'completed', 150000, '2026-09-10 08:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[2], v_s2, '2026-09-10', '12:00', '12:30', 30, 'completed', 45000, '2026-09-10 09:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[3], v_s1, '2026-09-10', '13:30', '14:15', 45, 'completed', 80000, '2026-09-10 10:50:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[4], v_s4, '2026-09-10', '15:00', '15:35', 35, 'completed', 60000, '2026-09-10 12:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[5], v_s3, '2026-09-10', '16:30', '17:30', 60, 'completed', 150000, '2026-09-10 13:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[6], v_s1, '2026-09-10', '18:15', '19:00', 45, 'completed', 80000, '2026-09-10 14:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[7], v_s5, '2026-09-10', '19:30', '19:50', 20, 'cancelled', 35000, '2026-09-10 15:00:00+05');

  -- ── 11-sentabr: 5 ta (~430 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[8], v_s1, '2026-09-11', '09:45', '10:30', 45, 'completed', 80000, '2026-09-11 08:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[9], v_s2, '2026-09-11', '11:15', '11:45', 30, 'completed', 45000, '2026-09-11 09:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[10], v_s4, '2026-09-11', '13:00', '13:35', 35, 'completed', 60000, '2026-09-11 10:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[11], v_s1, '2026-09-11', '15:15', '16:00', 45, 'completed', 80000, '2026-09-11 12:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[12], v_s3, '2026-09-11', '17:15', '18:15', 60, 'completed', 150000, '2026-09-11 14:00:00+05');

  -- ── 12-sentabr: 6 ta yakunlangan (~515 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[13], v_s1, '2026-09-12', '09:30', '10:15', 45, 'completed', 80000, '2026-09-12 08:10:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[14], v_s2, '2026-09-12', '11:00', '11:30', 30, 'completed', 45000, '2026-09-12 09:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[1], v_s3, '2026-09-12', '12:30', '13:30', 60, 'completed', 150000, '2026-09-12 10:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[2], v_s1, '2026-09-12', '14:30', '15:15', 45, 'completed', 80000, '2026-09-12 11:45:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[3], v_s4, '2026-09-12', '16:00', '16:35', 35, 'completed', 60000, '2026-09-12 13:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[4], v_s3, '2026-09-12', '17:30', '18:30', 60, 'completed', 150000, '2026-09-12 14:15:00+05');

  -- ── 13-sentabr (BUGUN!): 3 ta completed + 3 ta upcoming (Jami 6 ta, 565 000 so'm)
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    -- Ertalabki va tushki (Completed)
    (gen_random_uuid(), v_pid, v_client_ids[5], v_s1, '2026-09-13', '09:30', '10:15', 45, 'completed', 80000, '2026-09-13 08:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[6], v_s3, '2026-09-13', '11:00', '12:00', 60, 'completed', 150000, '2026-09-13 09:15:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[7], v_s2, '2026-09-13', '13:00', '13:30', 30, 'completed', 45000, '2026-09-13 10:20:00+05'),
    -- Kutilayotgan (Upcoming - Dashboardda birinchi bo'lib ko'rinadi)
    (gen_random_uuid(), v_pid, v_client_ids[8], v_s1, '2026-09-13', '16:00', '16:45', 45, 'upcoming', 80000, '2026-09-13 11:30:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[9], v_s3, '2026-09-13', '17:30', '18:30', 60, 'upcoming', 150000, '2026-09-13 12:00:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[10], v_s4, '2026-09-13', '19:15', '19:50', 35, 'upcoming', 60000, '2026-09-13 13:00:00+05');

  -- ── 14-sentabr (Ertaga): 3 ta upcoming
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[11], v_s1, '2026-09-14', '10:00', '10:45', 45, 'upcoming', 80000, '2026-09-13 13:10:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[12], v_s3, '2026-09-14', '14:00', '15:00', 60, 'upcoming', 150000, '2026-09-13 13:20:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[13], v_s2, '2026-09-14', '17:30', '18:00', 30, 'upcoming', 45000, '2026-09-13 13:30:00+05');

  -- ── 15-sentabr: 2 ta upcoming
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[14], v_s1, '2026-09-15', '11:00', '11:45', 45, 'upcoming', 80000, '2026-09-13 13:40:00+05'),
    (gen_random_uuid(), v_pid, v_client_ids[1], v_s3, '2026-09-15', '16:00', '17:00', 60, 'upcoming', 150000, '2026-09-13 13:50:00+05');

  -- ── 16-sentabr: 1 ta upcoming
  insert into public.bookings (id, provider_id, client_id, service_id, booking_date, start_time, end_time, duration_minutes, status, price, created_at)
  values
    (gen_random_uuid(), v_pid, v_client_ids[2], v_s2, '2026-09-16', '15:00', '15:30', 30, 'upcoming', 45000, '2026-09-13 14:00:00+05');

  -- 7) To'lovlar (payments) — Barcha completed bronlar uchun to'lov yozamiz
  -- ~55% Click (Online), ~45% Naqd (Cash)
  insert into public.payments (
    id, booking_id, provider_id, client_id, amount, status,
    method, channel, kind, created_at, paid_at
  )
  select
    gen_random_uuid(),
    b.id,
    b.provider_id,
    b.client_id,
    b.price,
    'paid',
    case when row_number() over (order by b.booking_date, b.start_time) % 2 = 1 then 'click' else 'cash' end,
    case when row_number() over (order by b.booking_date, b.start_time) % 2 = 1 then 'online' else 'cash' end,
    'full',
    b.created_at,
    (b.booking_date::text || ' ' || b.start_time || ':00')::timestamp with time zone
  from public.bookings b
  where b.provider_id = v_pid
    and b.status = 'completed';

  -- 8) Faol navbat (waitlist) — 2 ta mijoz kutmoqda
  insert into public.waitlist (
    id, provider_id, client_id, desired_date, time_from, time_to,
    duration_minutes, status, flexible, created_at
  ) values
    (gen_random_uuid(), v_pid, v_client_ids[3], v_today, '16:30', '18:00', 45, 'waiting', true, now() - interval '40 minutes'),
    (gen_random_uuid(), v_pid, v_client_ids[4], v_today, '18:00', '20:00', 60, 'waiting', true, now() - interval '15 minutes');

  raise notice 'BarberOne (997700001008) sentyabr oyi ma''lumotlari muvaffaqiyatli yuklandi!';
end
$seed_barber$;
