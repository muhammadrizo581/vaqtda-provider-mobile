// Payme checkout URL — tarif to'lovi uchun. Mijoz ilovasi (vaqtda-mobile lib/payment.ts)
// bilan bir xil format: base64("m=<merchant>;ac.order_id=<bookingId>;a=<tiyin>;l=uz;c=<qaytish>").
// Payme webhook (vaqtda-mobile functions/payme) account.order_id bo'yicha buyurtmani topadi.

const PAYME_MERCHANT_ID = process.env.EXPO_PUBLIC_PAYME_MERCHANT_ID || "";

// Payme kaliti sozlanganmi (bo'lmasa to'lov usuli sifatida ko'rsatilmaydi)
export const PAYME_ENABLED = !!PAYME_MERCHANT_ID;

// ASCII satr uchun base64 (RN'da Buffer yo'q; btoa'ga tayanmaymiz)
function base64(input: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let out = "";
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++);
    const c2 = input.charCodeAt(i++);
    const c3 = input.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | ((isNaN(c2) ? 0 : c2) >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | ((isNaN(c3) ? 0 : c3) >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    out += chars[e1] + chars[e2] + chars[e3] + chars[e4];
  }
  return out;
}

/** Payme to'lov sahifasi URL'i (summa so'mda beriladi, Payme'ga tiyinda ketadi) */
export function buildPaymeCheckoutUrl(orderId: string, amountSom: number): string {
  const tiyin = Math.max(100, Math.round(amountSom * 100));
  const payload = `m=${PAYME_MERCHANT_ID};ac.order_id=${orderId};a=${tiyin};l=uz;c=https://vaqtda.uz`;
  return `https://checkout.paycom.uz/${base64(payload)}`;
}
