// subscription-checkout — provayder tarifni (PLUS/PRO, oylik/yillik) sotib olish uchun buyurtma yaratadi.
//
// Mavjud to'lov infratuzilmasi bilan bir xil sxema (web panel va mijoz ilovasi ham shunday):
//   • bookings qatori = to'lov buyurtmasi, notes = "SUB__<plan>" yoki "SUB__<plan>__yearly".
//     Click / Payme checkout'ga shu qatorning id'si (order_id) beriladi.
//   • click / payme webhook'lari (vaqtda-mobile) to'lovni tasdiqlab payment_status='paid' qiladi,
//     bazadagi trg_subscription_completed trigger providers tarifini faollashtiradi
//     va subscription_payments yozuvini 'completed' qiladi.
//
// Nega server'da: narx shu yerda belgilanadi — ilova summani o'zgartirib, arzonga
// tarif ola olmaydi (webhook summani aynan shu buyurtmadagi prepay_amount bilan solishtiradi).
//
// Buyurtma bron jadvalida bo'lsa ham MIJOZ BRONI EMAS, shuning uchun:
//   • status = 'cancelled' — bookings_no_overlap cheklovi bekor qilinganlarni hisobga olmaydi,
//     aks holda obuna buyurtmasi shu kungi haqiqiy bronlar bilan to'qnashardi (dacha/kvartira)
//   • confirm_sent / review_requested_sent = true — "bron qabul qilindi" va "baho bering"
//     xabarlari egaga ketmasin (qolgan ikki trigger: supabase/subscription-orders.sql)
//
// Deploy: supabase functions deploy subscription-checkout

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Narxlar (so'm) — ilovadagi src/utils/plan.ts PLAN_PRICES bilan bir xil bo'lishi shart
const PRICES = {
  plus: { monthly: 25000, yearly: 240000 },
  pro: { monthly: 50000, yearly: 480000 },
} as const;

type Plan = keyof typeof PRICES;
type Cycle = keyof (typeof PRICES)["plus"];

// Bugungi sana Toshkent vaqti bo'yicha (YYYY-MM-DD)
function tashkentToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    // 1) Chaqiruvchi — faqat biznes egasi o'z biznesiga tarif sotib oladi
    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const plan = String(body.plan ?? "") as Plan;
    const cycle = String(body.cycle ?? "") as Cycle;
    const method = String(body.method ?? "");
    if (!(plan in PRICES)) return json({ error: "invalid_plan" }, 400);
    if (cycle !== "monthly" && cycle !== "yearly") return json({ error: "invalid_cycle" }, 400);
    if (method !== "click" && method !== "payme") return json({ error: "invalid_method" }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: provider } = await admin
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!provider) return json({ error: "not_owner" }, 403);

    const amount = PRICES[plan][cycle];
    const notes = cycle === "yearly" ? `SUB__${plan}__yearly` : `SUB__${plan}`;

    // 2) To'lov buyurtmasi (bookings qatori — webhook'lar shuni kutadi)
    const { data: order, error: orderErr } = await admin
      .from("bookings")
      .insert({
        client_id: user.id,
        provider_id: provider.id,
        booking_date: tashkentToday(),
        start_time: "00:00",
        end_time: "00:30",
        duration_minutes: 30,
        price: amount,
        prepay_amount: amount,
        status: "cancelled",
        notes,
        payment_status: "unpaid",
        payment_method: method,
        confirm_sent: true,
        review_requested_sent: true,
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      console.error("[subscription-checkout] bookings:", orderErr?.message);
      return json({ error: "order_failed" }, 500);
    }

    // 3) Obuna to'lovlari tarixi — trigger to'lov tushganda 'completed' qiladi
    const { data: subPayment, error: subErr } = await admin
      .from("subscription_payments")
      .insert({
        provider_id: provider.id,
        plan_code: plan,
        amount,
        payment_method: method,
        status: "pending",
        period_months: cycle === "yearly" ? 12 : 1,
        transaction_id: order.id,
      })
      .select("id")
      .single();
    if (subErr || !subPayment) {
      console.error("[subscription-checkout] subscription_payments:", subErr?.message);
      await admin.from("bookings").delete().eq("id", order.id);
      return json({ error: "order_failed" }, 500);
    }

    return json({ ok: true, order_id: order.id, sub_payment_id: subPayment.id, amount, plan, cycle });
  } catch (err) {
    console.error("[subscription-checkout] Server xatosi:", err);
    return json({ error: "server_error" }, 500);
  }
});
