-- ============================================================================
-- Barber House (provider1@gmail.com) uchun iyul oyi demo bronlari.
-- 1-iyuldan bugungacha: kuniga 2-4 ta (yakshanba dam), ~90% yakunlangan,
-- ~10% bekor qilingan. Bugun: 3 ta (o'tgan vaqtdagilar yakunlangan, qolgani
-- kutilmoqda). 31-iyul: 2 ta kutilmoqda. Qayta ishga tushirsa dublikat qilmaydi.
-- Supabase SQL Editor'da BUTUN faylni bitta qilib ishga tushiring.
-- ============================================================================
do $seed$
declare
  v_pid     uuid;
  v_today   date := (now() at time zone 'Asia/Tashkent')::date;
  v_now     time := (now() at time zone 'Asia/Tashkent')::time;
  v_names   text[] := array[
    'Aziz Karimov','Jasur Toshmatov','Sardor Rahimov','Bekzod Aliyev',
    'Timur Yusupov','Otabek Nazarov','Shohruh Ergashev','Doniyor Islomov'
  ];
  v_clients uuid[] := '{}';
  v_uid     uuid;
  v_email   text;
  v_svc_id  uuid;
  v_price   numeric;
  v_dur     int;
  d         date;
  j         int;
  k         int;
  v_start   time;
  v_end     time;
  v_status  text;
begin
  -- 1) Provider
  select p.id into v_pid
    from public.providers p
    join auth.users u on u.id = p.user_id
   where u.email = 'provider1@gmail.com';
  if v_pid is null then
    raise exception 'provider1@gmail.com uchun provider topilmadi';
  end if;

  -- 2) Demo mijozlar (yo'q bo'lsa yaratiladi, parol: test1234)
  for j in 1..array_length(v_names, 1) loop
    v_email := 'client.demo-' || j || '@vaqtda.uz';
    select id into v_uid from auth.users where email = v_email;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, extensions.crypt('test1234', extensions.gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_names[j]), '', '', '', ''
      );
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now()
      );
    end if;
    insert into public.profiles (id, full_name, phone)
    values (v_uid, v_names[j], '+998 9' || (j % 10) || ' ' || (100 + j * 37) || ' ' || (10 + j) || ' ' || (20 + j * 3))
    on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;
    v_clients := v_clients || v_uid;
  end loop;

  -- 3) Provider xizmatlari
  create temp table _svcs on commit drop as
    select id, coalesce(price, 60000) as price, coalesce(duration_minutes, 40) as dur
      from public.services
     where provider_id = v_pid and coalesce(is_active, true);
  if not exists (select 1 from _svcs) then
    raise exception 'Bu providerda faol xizmat topilmadi';
  end if;

  -- 4) Oldingi demo bronlarni tozalash (idempotent)
  delete from public.bookings
   where provider_id = v_pid
     and client_id = any (v_clients)
     and booking_date between date '2026-07-01' and date '2026-07-31';

  -- 5) Bronlar
  for d in select generate_series(date '2026-07-01', date '2026-07-31', interval '1 day')::date loop
    if to_char(d, 'FMDay') = 'Sunday' then continue; end if;  -- yakshanba dam

    if d < v_today then
      k := 2 + floor(random() * 3)::int;          -- o'tgan kunlar: 2-4 ta
    elsif d = v_today then
      k := 3;                                     -- bugun: 3 ta
    else
      k := 2;                                     -- 31-iyul: 2 ta
    end if;

    for j in 1..k loop
      select id, price, dur into v_svc_id, v_price, v_dur
        from _svcs order by random() limit 1;

      -- 09:00 dan boshlab har 2 soatda, 0-35 daqiqa tasodifiy siljish
      v_start := time '09:00' + ((j - 1) * interval '2 hours')
                 + (floor(random() * 8)::int * interval '5 minutes');
      v_end := v_start + make_interval(mins => v_dur);

      -- Shu vaqtda bron bo'lsa (sizniki yoki boshqasi) — bu bittasini tashlab ketamiz
      if exists (
        select 1 from public.bookings b
         where b.provider_id = v_pid
           and b.booking_date = d
           and b.start_time::time < v_end
           and b.end_time::time > v_start
      ) then
        continue;
      end if;

      if d < v_today then
        v_status := case when random() < 0.10 then 'cancelled' else 'completed' end;
      elsif d = v_today then
        v_status := case when v_end <= v_now then 'completed' else 'upcoming' end;
      else
        v_status := 'upcoming';
      end if;

      insert into public.bookings (
        provider_id, client_id, service_id, booking_date,
        start_time, end_time, duration_minutes, status, price,
        created_at, updated_at
      ) values (
        v_pid,
        -- power(...) — ayrim mijozlar ko'proq keladi (Top mijozlar chiroyli chiqishi uchun)
        v_clients[1 + floor(power(random(), 1.7) * array_length(v_clients, 1))::int],
        v_svc_id, d, v_start, v_end, v_dur, v_status, v_price,
        (d - (1 + floor(random() * 3)::int))::timestamp + time '18:30', now()
      )
      on conflict do nothing;
    end loop;
  end loop;

  raise notice 'Tayyor: iyul oyi demo bronlari qo''shildi';
end
$seed$;

-- Tekshirish (ixtiyoriy):
-- select booking_date, count(*) jami,
--        count(*) filter (where status='completed') yakunlangan,
--        count(*) filter (where status='cancelled') bekor,
--        count(*) filter (where status='upcoming') kutilmoqda
--   from public.bookings b
--   join public.providers p on p.id = b.provider_id
--   join auth.users u on u.id = p.user_id
--  where u.email = 'provider1@gmail.com' and booking_date >= '2026-07-01'
--  group by 1 order by 1;
