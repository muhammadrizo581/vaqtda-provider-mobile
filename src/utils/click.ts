// Click checkout URL — qolgan summa (remainder) uchun QR kodda ishlatiladi.
// Mijoz QR'ni skanerlaydi → my.click.uz'da to'laydi → Click webhook (vaqtda-mobile
// functions/click) merchant_trans_id="<bookingId>__R" ni remainder deb qayta ishlaydi.
// SECRET bu yerda EMAS — u faqat server (webhook) tomonida.

const CLICK_MERCHANT_ID = process.env.EXPO_PUBLIC_CLICK_MERCHANT_ID || "";
const CLICK_SERVICE_ID = process.env.EXPO_PUBLIC_CLICK_SERVICE_ID || "";

// Click kalitlari sozlanganmi (bo'lmasa online QR ko'rsatilmaydi)
export const CLICK_ENABLED = !!(CLICK_MERCHANT_ID && CLICK_SERVICE_ID);

// Remainder to'lov uchun transaction_param — webhook "__R" bo'yicha ajratadi
export function remainderParam(bookingId: string): string {
  return `${bookingId}__R`;
}

// Click to'lov sahifasi URL'i (summa so'mda). Shu URL QR kodga aylantiriladi.
export function buildClickCheckoutUrl(transactionParam: string, amountSom: number): string {
  const p = new URLSearchParams({
    service_id: CLICK_SERVICE_ID,
    merchant_id: CLICK_MERCHANT_ID,
    amount: String(Math.round(amountSom)),
    transaction_param: transactionParam,
  });
  return `https://my.click.uz/services/pay?${p.toString()}`;
}
