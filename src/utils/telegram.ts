const PAYOUT_BOT_TOKEN = "8800056401:AAH6hoLUxVTPYEyOGEC80ID3x6g-_1DKw0A";
const PAYOUT_CHAT_ID = "-1004415219710";

export interface TelegramPayoutAlertParams {
  payoutId: string;
  businessName: string;
  businessSlug?: string;
  ownerName: string;
  ownerPhone: string;
  cardNumberMasked: string;
  cardNumberFull?: string | null;
  cardHolderName?: string | null;
  cardBrand?: string | null;
  amountSom: number;
  createdAt?: string;
}

export async function sendTelegramPayoutAlert(params: TelegramPayoutAlertParams) {
  if (!PAYOUT_BOT_TOKEN || !PAYOUT_CHAT_ID) return;

  const {
    payoutId,
    businessName,
    businessSlug,
    ownerName,
    ownerPhone,
    cardNumberMasked,
    cardNumberFull,
    cardHolderName,
    cardBrand,
    amountSom,
    createdAt,
  } = params;

  const timeStr = createdAt
    ? new Date(createdAt).toLocaleString("uz-UZ", {
        timeZone: "Asia/Tashkent",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

  const cardDisplay = cardNumberFull
    ? `<code>${cardNumberFull}</code>`
    : `<b>${cardNumberMasked}</b>`;

  const holderStr = cardHolderName ? ` (${cardHolderName})` : "";
  const brandStr = cardBrand ? ` [${cardBrand}]` : "";

  const text = `🔔 <b>YANGI PUL YECHISH SO'ROVI! (Mobile)</b>
━━━━━━━━━━━━━━━━━━━━
🏢 <b>Biznes:</b> ${businessName}${businessSlug ? ` (@${businessSlug})` : ""}
👤 <b>Egasi:</b> ${ownerName}
📞 <b>Telefon:</b> ${ownerPhone || "Ko'rsatilmagan"}
💳 <b>Karta raqami:</b> ${cardDisplay}${holderStr}${brandStr}
💰 <b>So'ralgan summa:</b> <b>${amountSom.toLocaleString("ru-RU")} UZS</b>
📅 <b>Sana:</b> ${timeStr}
🆔 <b>So'rov ID:</b> <code>${payoutId}</code>
━━━━━━━━━━━━━━━━━━━━
ℹ️ <i>Admin ushbu kartaga pul o'tkazib bergach, pastdagi '✅ Bajarildi' tugmasini bosing yoki to'lov cheki rasmini shu xabarga 'Reply' qiling.</i>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ Bajarildi (To'landi)",
          callback_data: `payout_approve_${payoutId}`,
        },
        {
          text: "❌ Rad etish",
          callback_data: `payout_reject_${payoutId}`,
        },
      ],
    ],
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${PAYOUT_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PAYOUT_CHAT_ID,
        text,
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[Telegram Payout Mobile Alert Error]", err);
  }
}
