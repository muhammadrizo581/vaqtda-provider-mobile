-- ════════════════════════════════════════════════════════════════════════════
-- VAQTDA — QO'LDA YAKUNLANGAN BRON UCHUN "BAHO BERING" (review_request) XABARI
-- Supabase → SQL Editor → butun faylni bir marta RUN qiling. To'liq idempotent.
--
-- MUAMMO (bazadan o'rganilgan):
--   • Mijozga keladigan IN-APP "yakunlandi — baho bering" bildirishnomasi
--     (public.notifications → ilova + push) bazadagi alohida emitter tomonidan
--     FAQAT uchrashuv vaqti O'TGACH yaratiladi.
--   • Shu sabab provayder/usta KELGUSI sanadagi bronni mijoz bilan kelishib ERTA
--     yakunlaganda (status='completed'), uchrashuv vaqti hali kelmagani uchun mijozga
--     hech qanday IN-APP xabar bormaydi. (Empirik tasdiq: booking_date kelajakda
--     bo'lgan, review_requested_sent=true bo'lgan yakunlangan bronlarda notifications
--     jadvalida review_request YO'Q edi.)
--
--   • bookings.review_requested_sent — bu TELEGRAM boti (vaqtda-bot) bayrog'i. Bot
--     cron yakunlangan bronga (sanadan qat'i nazar) Telegram "baho bering" xabarini
--     yuboradi va shu bayroqni true qiladi. SHUNING UCHUN bu yerda uni HECH QACHON
--     o'zgartirmaymiz (aks holda bot Telegram xabarini yubormay qoladi) va unga
--     TAYANMAYMIZ. Dedupe faqat notifications mavjudligiga qarab qilinadi.
--
-- YECHIM: yakunlash bosilgan joydan chaqiriladigan SECURITY DEFINER funksiyalar.
--   • emit_review_request(booking_id) — faqat IN-APP xabar (dedupe). Status'ni o'ZI
--     yangilaydigan yo'l (provayder — bookings UPDATE RLS ruxsat bor) shuni chaqiradi.
--   • complete_booking(booking_id)    — status='completed' QILADI, so'ng xabar. Usta
--     (worker) uchun: unga bookings UPDATE RLS'da yopiq, shu sabab SECURITY DEFINER
--     orqali yakunlanadi.
--
-- Ikkalasi ham EGALIKNI (auth.uid() shu bronning provayderi yoki ustasimi)
-- tekshiradi. Web-panel (vaqtda-provider) service_role bilan ishlagani uchun bu
-- RPC'larni chaqirmaydi — u serverda o'sha mantiqni bajaradi (utils/notifications.ts).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Egalik: auth.uid() shu bronning provayderi yoki biriktirilgan ustasimi? ──
CREATE OR REPLACE FUNCTION public.is_booking_staff_or_owner(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = p_booking_id
      AND (
        EXISTS (SELECT 1 FROM public.providers p
                 WHERE p.id = b.provider_id AND p.user_id = auth.uid())
        -- worker_id va staff_id — bir xil id (workers.id = provider_staff.id)
        OR EXISTS (SELECT 1 FROM public.workers w
                    WHERE w.user_id = auth.uid()
                      AND w.id IN (b.worker_id, b.staff_id))
      )
  );
$$;

-- ── 2) IN-APP "baho bering" xabari (dedupe; telegram bayrog'iga TEGMAYDI) ──────
CREATE OR REPLACE FUNCTION public.emit_review_request(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b        public.bookings;
  prov_slug text;
BEGIN
  IF NOT public.is_booking_staff_or_owner(p_booking_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL OR b.status <> 'completed' THEN
    RETURN;                              -- faqat yakunlangan bron uchun
  END IF;

  -- Dedupe: shu bron uchun in-app review_request allaqachon bo'lsa — chiqamiz
  -- (bazadagi emitter yoki oldingi chaqiruv yaratgan bo'lishi mumkin).
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'review_request'
      AND data->>'booking_id' = p_booking_id::text
  ) THEN
    RETURN;
  END IF;

  SELECT slug INTO prov_slug FROM public.providers WHERE id = b.provider_id;

  -- notifications INSERT = ilovada ko'rinadi + push avtomatik ketadi
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    b.client_id,
    'review_request',
    jsonb_build_object('ru', 'Оцените услугу', 'uz', 'Xizmatga baho bering'),
    jsonb_build_object(
      'ru', 'Ваша запись завершена — пожалуйста, оставьте отзыв.',
      'uz', 'Uchrashuvingiz yakunlandi — iltimos, baho qoldiring.'
    ),
    jsonb_build_object('slug', prov_slug, 'booking_id', b.id, 'provider_id', b.provider_id)
  );
END;
$$;

-- ── 3) Yakunlash: status='completed' + xabar (usta uchun — RLS'ni chetlab) ─────
CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.bookings;
BEGIN
  IF NOT public.is_booking_staff_or_owner(p_booking_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'booking not found';
  END IF;
  IF b.status = 'cancelled' THEN
    RAISE EXCEPTION 'cannot complete a cancelled booking';
  END IF;

  IF b.status <> 'completed' THEN
    UPDATE public.bookings
       SET status = 'completed', updated_at = now()
     WHERE id = p_booking_id;
  END IF;

  PERFORM public.emit_review_request(p_booking_id);
  RETURN 'completed';
END;
$$;

-- ── 4) Ruxsatlar — faqat kirgan foydalanuvchi (provayder/usta) chaqira olsin ───
REVOKE ALL ON FUNCTION public.emit_review_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_booking(uuid)    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_review_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_booking(uuid)    TO authenticated;
-- is_booking_staff_or_owner ichki chaqiriladi (definer) — alohida grant shart emas.
