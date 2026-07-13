// ─── Toshkent (Asia/Tashkent, UTC+5) vaqti bilan ishlash ──────────────────────
// Qurilma soat zonasi noto'g'ri bo'lsa ham har doim Toshkent vaqtini beradi.
// .sync(supabase) chaqirilsa, server vaqti bilan tekislanadi (qurilma soati buzuq
// bo'lsa ham to'g'ri ishlaydi). RPC bo'lmasa Intl asosida ishlayveradi.

export interface TashkentNow {
  dateStr: string;    // "2026-06-16"
  hhmm: string;       // "14:05"
  weekdayKey: string; // "Monday" — DB day_of_week kalitlariga mos (inglizcha)
}

const WEEKDAY_MAP: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

export const UZ_WEEKDAYS: Record<string, string> = {
  Monday: "Dushanba", Tuesday: "Seshanba", Wednesday: "Chorshanba",
  Thursday: "Payshanba", Friday: "Juma", Saturday: "Shanba", Sunday: "Yakshanba",
};

export const UZ_WEEKDAYS_SHORT: Record<string, string> = {
  Monday: "Du", Tuesday: "Se", Wednesday: "Ch", Thursday: "Pa",
  Friday: "Ju", Saturday: "Sh", Sunday: "Ya",
};

export const RU_WEEKDAYS_SHORT: Record<string, string> = {
  Monday: "Пн", Tuesday: "Вт", Wednesday: "Ср", Thursday: "Чт",
  Friday: "Пт", Saturday: "Сб", Sunday: "Вс",
};

export const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function partsAt(ms: number, withSeconds = false): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    weekday: "short", hour12: false,
  });
  const p: Record<string, string> = {};
  dtf.formatToParts(new Date(ms)).forEach((x) => {
    if (x.type !== "literal") p[x.type] = x.value;
  });
  if (p.hour === "24") p.hour = "00";
  return p;
}

export function tashkentFromMs(ms: number): TashkentNow {
  const p = partsAt(ms);
  return {
    dateStr: `${p.year}-${p.month}-${p.day}`,
    hhmm: `${p.hour}:${p.minute}`,
    weekdayKey: WEEKDAY_MAP[p.weekday] || "Monday",
  };
}

function tashkentWallMs(ms: number): number {
  const p = partsAt(ms, true);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +(p.second || "0"));
}

/** "YYYY-MM-DD" ga n kun qo'shadi (soat zonasidan mustaqil) */
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" qaysi hafta kuni ("Monday"...) */
export function weekdayKeyOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const KEYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-06-16" → "16-iyun" */
export function formatUzDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d}-${UZ_MONTHS[m - 1]}`;
}

export function createTashkentClock() {
  let offsetMs = 0;
  return {
    now(): TashkentNow {
      return tashkentFromMs(Date.now() + offsetMs);
    },
    async sync(supabase: { rpc: (fn: string) => PromiseLike<{ data: unknown }> }) {
      try {
        const { data } = await supabase.rpc("get_tashkent_now");
        if (typeof data === "string") {
          const m = data.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
          if (m) {
            const serverWall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
            offsetMs = serverWall - tashkentWallMs(Date.now());
          }
        }
      } catch {
        /* Intl fallback */
      }
    },
  };
}