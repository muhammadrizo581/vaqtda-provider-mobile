-- ============================================================
-- subscription-orders.sql — tarif (obuna) buyurtmalariga bron xabarlari yuborilmasin.
--
-- Tarif to'lovi bookings jadvalidagi maxsus qator orqali o'tadi (notes LIKE 'SUB__%'),
-- chunki Click/Payme webhook'lari buyurtma sifatida bronni kutadi. Bu qator mijoz
-- broni EMAS, lekin ikki trigger uni oddiy bron deb biladi:
--   • trg_notify_provider_on_booking — INSERT'da egaga "Sizga yangi bron! 🎉"
--   • trg_booking_paid               — to'langanda egaga "Bron qabul qilindi ✅" (+ Telegram)
-- Quyida ikkala funksiya asl holicha qoldirilib, faqat boshiga obuna buyurtmasini
-- o'tkazib yuboruvchi shart qo'shildi. Oddiy bronlar uchun xatti-harakat o'zgarmaydi.
--
-- Ishga tushirish: Supabase Dashboard → SQL Editor → Run. Idempotent.
-- ============================================================

create or replace function public.notify_provider_on_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  prov_user uuid;
  cli_name text;
  when_txt text;
begin
  -- Obuna (tarif) buyurtmasi — mijoz broni emas
  if coalesce(new.notes, '') like 'SUB\_\_%' then
    return new;
  end if;

  select user_id into prov_user from public.providers where id = new.provider_id;
  if prov_user is null then
    return new;
  end if;

  select coalesce(nullif(full_name, ''), 'Mijoz') into cli_name
  from public.profiles where id = new.client_id;

  when_txt := to_char(new.booking_date, 'DD.MM.YYYY')
    || case when new.start_time is not null and new.start_time <> ''
            then ', ' || left(new.start_time, 5) else '' end;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    prov_user,
    'new_booking',
    jsonb_build_object('uz', 'Sizga yangi bron! 🎉', 'ru', 'Новое бронирование! 🎉'),
    jsonb_build_object(
      'uz', coalesce(cli_name, 'Mijoz') || ' — ' || when_txt,
      'ru', coalesce(cli_name, 'Клиент') || ' — ' || when_txt
    ),
    jsonb_build_object('type', 'new_booking', 'booking_id', new.id)
  );
  return new;
exception when others then
  -- Xabarnoma yiqilsa bron saqlanishiga xalaqit bermasin
  raise warning 'notify_provider_on_booking failed: %', sqlerrm;
  return new;
end;
$function$;

create or replace function public.notify_booking_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Obuna (tarif) buyurtmasi — faollashuv xabarini process_subscription_payment yuboradi
  if coalesce(new.notes, '') like 'SUB\_\_%' then
    return new;
  end if;

  perform public.emit_booking_confirmation(new);
  return new;
end;
$function$;
