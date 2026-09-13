-- ============================================================================
-- BarberOne uchun bugundan boshlab keyingi haftagacha (13-20 sentabr)
-- barcha kunlarga mijozlar nomidan bronlar qo'shish.
--
-- "Bronlar" (Appointments) sahifasida:
--   • Bugun (13-sentabr): 4 ta kutilayotgan + 3 ta yakunlangan bron
--   • Ertaga (14-sentabr): 5 ta kutilayotgan bron
--   • 15-sentabr (Seshanba): 5 ta kutilayotgan bron
--   • 16-sentabr (Chorshanba): 5 ta kutilayotgan bron
--   • 17-sentabr (Payshanba): 5 ta kutilayotgan bron
--   • 18-sentabr (Juma): 5 ta kutilayotgan bron
--   • 19-sentabr (Shanba): 6 ta kutilayotgan bron
--   • 20-sentabr (Yakshanba): 5 ta kutilayotgan bron
--
-- Har bir bron mijoz ismi, telefoni, xizmat nomi, usta ismi va qulay vaqti bilan.
-- ============================================================================

do $seed_upcoming$
declare
  v_pid    uuid := '3bd3b9a8-ccc2-41a7-b850-8dc7f1353f9c';
  v_staff1 uuid := '23af8be2-28b1-49e8-b8b3-83030c4335a8'; -- Sardor Karimov (Top Barber)
  v_staff2 uuid := '3a09df57-9d91-47ba-9dda-3b383ccfb962'; -- Javohir Toshmatov (Stilist)
  v_s1     uuid := 'f009cfb7-6478-4827-b43e-e71079a06bcb'; -- Erkaklar soch turmagi (80 000, 45 daq)
  v_s2     uuid := 'b0161d69-e228-47a8-b0bf-33528281283c'; -- Soqol olish (45 000, 30 daq)
  v_s3     uuid := 'b359a47b-99cb-4ca1-be7f-7c62d99367dd'; -- VIP Kompleks (150 000, 60 daq)
  v_s4     uuid := 'b4f9dc56-1829-4def-8fb2-a9ec4121be63'; -- Bolalar soch turmagi (60 000, 35 daq)
  v_s5     uuid := 'd7723550-b8d5-4f8f-8269-b9019cb9a898'; -- Soch yuvish va styling (35 000, 20 daq)

  -- Mijozlar (auth.users va profiles dagi haqiqiy IDlar)
  c1  uuid := 'e2ddae45-4b5e-4cf7-9280-5516eeb0560a'; -- Jasur Rahimov
  c2  uuid := '7e1d5de4-8430-4e03-87c8-900ffcba3ff4'; -- Bobur Mirzayev
  c3  uuid := '68772b4f-62c8-48e6-8f3f-8e7aa7b8c034'; -- Ulug'bek Yusupov
  c4  uuid := '4ac1da30-654e-4b11-81df-c719a4da8122'; -- Bekzod Qodirov
  c5  uuid := 'b0afa1db-5710-440f-a2cd-0952eadb245d'; -- Farhod Alimov
  c6  uuid := 'f7d51b34-7754-4391-b362-1e792a529d1c'; -- Sanjar Norov
  c7  uuid := '850b1a34-a4d2-4f77-be6c-5eb6d6a2508b'; -- Sherzod Toirov
  c8  uuid := '97464920-14dd-4eb0-9784-8330d3405759'; -- Rustam Hakimov
  c9  uuid := 'dd8275bb-468c-4bf2-b2fc-7e5ae4517fd3'; -- Shohruh Nazarov
  c10 uuid := 'df2b4ff4-2c4f-40c7-a20c-c44c54bd2e8b'; -- Jahongir Olimov
  c11 uuid := 'deaf5ab5-777b-4a39-9475-ddd84de15653'; -- Doniyor Ergashev
  c12 uuid := 'b92b9aa9-66ef-4ec1-85c1-95a172749133'; -- Otabek Ziyayev
  c13 uuid := '814a90a0-3296-4577-9177-cc05e87fcfa1'; -- Akmal G'aniyev
  c14 uuid := '2fa82e1c-d389-4e49-86f0-ef46beac6dee'; -- Dilshod Shukurov
  c15 uuid := '25d487b5-f4c7-43cb-ab06-42ab1a5d2a96'; -- Ibrohim Boltayev
begin
  -- 13-20 sentabr oralig'idagi eski kelajak bronlarni tozalaymiz (idempotent)
  delete from public.bookings
   where provider_id = v_pid
     and booking_date >= date '2026-09-13';

  -- ── 13-sentabr (Bugun): 3 ta completed + 4 ta upcoming
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c5, v_s1, v_staff1, '2026-09-13', '09:30', '10:15', 45, 'completed', 80000, 'Fade soch turmagi', '2026-09-13 08:00:00+05'),
    (v_pid, c6, v_s3, v_staff2, '2026-09-13', '11:00', '12:00', 60, 'completed', 150000, 'VIP kompleks parvarish', '2026-09-13 09:15:00+05'),
    (v_pid, c7, v_s2, v_staff1, '2026-09-13', '13:00', '13:30', 30, 'completed', 45000, 'Soqol shakli', '2026-09-13 10:20:00+05'),
    -- Kutilayotgan bronlar (Upcoming)
    (v_pid, c8, v_s1, v_staff1, '2026-09-13', '15:00', '15:45', 45, 'upcoming', 80000, 'Klassik erkaklar soch turmagi', '2026-09-13 11:30:00+05'),
    (v_pid, c9, v_s3, v_staff2, '2026-09-13', '16:30', '17:30', 60, 'upcoming', 150000, 'Soch + soqol + maska', '2026-09-13 12:00:00+05'),
    (v_pid, c10, v_s4, v_staff1, '2026-09-13', '18:00', '18:35', 35, 'upcoming', 60000, 'O''g''lim uchun soch turmagi', '2026-09-13 13:00:00+05'),
    (v_pid, c4, v_s2, v_staff2, '2026-09-13', '19:30', '20:00', 30, 'upcoming', 45000, 'Soqol tekislash', '2026-09-13 13:30:00+05');

  -- ── 14-sentabr (Dushanba / Ertaga): 5 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c1, v_s1, v_staff1, '2026-09-14', '10:00', '10:45', 45, 'upcoming', 80000, 'Crop stilida turmaklash', '2026-09-13 14:00:00+05'),
    (v_pid, c2, v_s2, v_staff2, '2026-09-14', '11:30', '12:00', 30, 'upcoming', 45000, 'Issiq sochiq bilan soqol olish', '2026-09-13 14:15:00+05'),
    (v_pid, c3, v_s3, v_staff1, '2026-09-14', '14:00', '15:00', 60, 'upcoming', 150000, 'VIP kompleks', '2026-09-13 14:30:00+05'),
    (v_pid, c11, v_s1, v_staff2, '2026-09-14', '16:00', '16:45', 45, 'upcoming', 80000, 'Tepasini qaychi bilan olish', '2026-09-13 15:00:00+05'),
    (v_pid, c12, v_s5, v_staff1, '2026-09-14', '18:30', '18:50', 20, 'upcoming', 35000, 'Styling va yuvish', '2026-09-13 15:20:00+05');

  -- ── 15-sentabr (Seshanba): 5 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c13, v_s1, v_staff1, '2026-09-15', '09:30', '10:15', 45, 'upcoming', 80000, 'Erkaklar soch turmagi', '2026-09-13 15:30:00+05'),
    (v_pid, c14, v_s3, v_staff2, '2026-09-15', '11:00', '12:00', 60, 'upcoming', 150000, 'To''y oldi kompleks parvarish', '2026-09-13 15:45:00+05'),
    (v_pid, c15, v_s2, v_staff1, '2026-09-15', '13:30', '14:00', 30, 'upcoming', 45000, 'Soqol konturlari', '2026-09-13 16:00:00+05'),
    (v_pid, c5, v_s4, v_staff2, '2026-09-15', '15:30', '16:05', 35, 'upcoming', 60000, 'Bolalar uchun yangi stil', '2026-09-13 16:15:00+05'),
    (v_pid, c6, v_s1, v_staff1, '2026-09-15', '17:30', '18:15', 45, 'upcoming', 80000, 'Low fade turmagi', '2026-09-13 16:30:00+05');

  -- ── 16-sentabr (Chorshanba): 5 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c7, v_s1, v_staff2, '2026-09-16', '10:00', '10:45', 45, 'upcoming', 80000, 'Standart erkaklar soch turmagi', '2026-09-13 16:45:00+05'),
    (v_pid, c8, v_s2, v_staff1, '2026-09-16', '12:00', '12:30', 30, 'upcoming', 45000, 'Soqol parvarishi', '2026-09-13 17:00:00+05'),
    (v_pid, c9, v_s3, v_staff2, '2026-09-16', '14:30', '15:30', 60, 'upcoming', 150000, 'VIP kompleks', '2026-09-13 17:15:00+05'),
    (v_pid, c10, v_s1, v_staff1, '2026-09-16', '16:30', '17:15', 45, 'upcoming', 80000, 'Middle fade', '2026-09-13 17:30:00+05'),
    (v_pid, c1, v_s5, v_staff2, '2026-09-16', '19:00', '19:20', 20, 'upcoming', 35000, 'Soch fiksatsiyasi', '2026-09-13 17:45:00+05');

  -- ── 17-sentabr (Payshanba): 5 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c2, v_s1, v_staff1, '2026-09-17', '09:30', '10:15', 45, 'upcoming', 80000, 'Klassik stil', '2026-09-13 18:00:00+05'),
    (v_pid, c3, v_s4, v_staff2, '2026-09-17', '11:15', '11:50', 35, 'upcoming', 60000, 'Bolalar soch turmagi', '2026-09-13 18:15:00+05'),
    (v_pid, c4, v_s3, v_staff1, '2026-09-17', '13:45', '14:45', 60, 'upcoming', 150000, 'VIP parvarish va massaj', '2026-09-13 18:30:00+05'),
    (v_pid, c11, v_s2, v_staff2, '2026-09-17', '16:00', '16:30', 30, 'upcoming', 45000, 'Soqol olish', '2026-09-13 18:45:00+05'),
    (v_pid, c12, v_s1, v_staff1, '2026-09-17', '18:00', '18:45', 45, 'upcoming', 80000, 'Taper fade', '2026-09-13 19:00:00+05');

  -- ── 18-sentabr (Juma): 5 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c13, v_s1, v_staff1, '2026-09-18', '10:00', '10:45', 45, 'upcoming', 80000, 'Juma namozi oldi turmaklash', '2026-09-13 19:15:00+05'),
    (v_pid, c14, v_s2, v_staff2, '2026-09-18', '11:30', '12:00', 30, 'upcoming', 45000, 'Soqol tekislash', '2026-09-13 19:30:00+05'),
    (v_pid, c15, v_s3, v_staff1, '2026-09-18', '14:00', '15:00', 60, 'upcoming', 150000, 'VIP kompleks', '2026-09-13 19:45:00+05'),
    (v_pid, c5, v_s1, v_staff2, '2026-09-18', '16:00', '16:45', 45, 'upcoming', 80000, 'Yonlarini qisqartirish', '2026-09-13 20:00:00+05'),
    (v_pid, c6, v_s1, v_staff1, '2026-09-18', '18:30', '19:15', 45, 'upcoming', 80000, 'Soch va soqol parvarishi', '2026-09-13 20:15:00+05');

  -- ── 19-sentabr (Shanba): 6 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c7, v_s1, v_staff1, '2026-09-19', '09:30', '10:15', 45, 'upcoming', 80000, 'Erkaklar soch turmagi', '2026-09-13 20:30:00+05'),
    (v_pid, c8, v_s4, v_staff2, '2026-09-19', '11:00', '11:35', 35, 'upcoming', 60000, 'Bolalar uchun soch turmagi', '2026-09-13 20:45:00+05'),
    (v_pid, c9, v_s3, v_staff1, '2026-09-19', '13:00', '14:00', 60, 'upcoming', 150000, 'VIP kompleks', '2026-09-13 21:00:00+05'),
    (v_pid, c10, v_s2, v_staff2, '2026-09-19', '15:00', '15:30', 30, 'upcoming', 45000, 'Soqol shakli', '2026-09-13 21:15:00+05'),
    (v_pid, c1, v_s1, v_staff1, '2026-09-19', '17:00', '17:45', 45, 'upcoming', 80000, 'Fade turmak', '2026-09-13 21:30:00+05'),
    (v_pid, c2, v_s5, v_staff2, '2026-09-19', '19:00', '19:20', 20, 'upcoming', 35000, 'Soch yuvish va styling', '2026-09-13 21:45:00+05');

  -- ── 20-sentabr (Yakshanba): 5 ta upcoming bron
  insert into public.bookings (provider_id, client_id, service_id, staff_id, booking_date, start_time, end_time, duration_minutes, status, price, notes, created_at)
  values
    (v_pid, c3, v_s1, v_staff1, '2026-09-20', '10:00', '10:45', 45, 'upcoming', 80000, 'Erkaklar soch turmagi', '2026-09-13 22:00:00+05'),
    (v_pid, c4, v_s2, v_staff2, '2026-09-20', '12:00', '12:30', 30, 'upcoming', 45000, 'Soqol parvarishi', '2026-09-13 22:15:00+05'),
    (v_pid, c11, v_s3, v_staff1, '2026-09-20', '14:00', '15:00', 60, 'upcoming', 150000, 'VIP kompleks', '2026-09-13 22:30:00+05'),
    (v_pid, c12, v_s4, v_staff2, '2026-09-20', '16:30', '17:05', 35, 'upcoming', 60000, 'Bolalar soch turmagi', '2026-09-13 22:45:00+05'),
    (v_pid, c13, v_s1, v_staff1, '2026-09-20', '18:30', '19:15', 45, 'upcoming', 80000, 'Classic turmak', '2026-09-13 23:00:00+05');

  -- 13-sentabrning 3 ta completed broni uchun to'lovlarni qayta yozamiz
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
    case when row_number() over (order by b.start_time) % 2 = 1 then 'click' else 'cash' end,
    case when row_number() over (order by b.start_time) % 2 = 1 then 'online' else 'cash' end,
    'full',
    b.created_at,
    (b.booking_date::text || ' ' || b.start_time || ':00')::timestamp with time zone
  from public.bookings b
  where b.provider_id = v_pid
    and b.booking_date = '2026-09-13'
    and b.status = 'completed';

  raise notice 'Keyingi haftagacha (13-20 sentabr) barcha bronlar muvaffaqiyatli yaratildi!';
end
$seed_upcoming$;
