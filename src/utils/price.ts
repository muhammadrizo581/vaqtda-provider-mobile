// Narxni "50 000" ko'rinishida formatlaydi (mingliklar orasida probel).
// null/bo'sh/noto'g'ri qiymat -> bo'sh satr.
export function formatSom(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
