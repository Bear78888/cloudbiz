/**
 * Time-zone helpers. Every organization has a timezone (§25.1) and every
 * scheduled job is entered in it — a 2 PM appointment must read as 2 PM to the
 * owner regardless of where the server runs.
 *
 * Pure functions over `Intl`; no dependency, no ambient timezone.
 */

const PARTS_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", { ...PARTS_FORMAT_OPTIONS, timeZone })
    .formatToParts(date)
    .reduce<Record<string, number>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = Number(part.value);
      return acc;
    }, {});
  // Some ICU versions render midnight as hour 24 under h23.
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

/** How far the zone is from UTC at that instant, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `<input type="datetime-local">` value (wall-clock, no zone) → ISO instant,
 * reading the wall clock in `timeZone`. Returns null for blank or malformed
 * input. Applying the offset twice settles DST boundaries: the first pass
 * gives an approximate instant, the second reads the offset actually in force
 * there.
 */
export function zonedInputToIso(value: string | null | undefined, timeZone: string): string | null {
  if (!value) return null;
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
  );
  if (!Number.isFinite(wallClock)) return null;

  const approximate = new Date(wallClock - zoneOffsetMs(new Date(wallClock), timeZone));
  const instant = new Date(wallClock - zoneOffsetMs(approximate, timeZone));
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** ISO instant → `<input type="datetime-local">` value in `timeZone`. */
export function isoToZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const LOCALE_TAG: Record<string, string> = { en: "en-US", es: "es-US" };

/** "Friday, 2:00 PM" style stamp for job cards (§13.9), in the org's zone. */
export function formatDateTime(
  iso: string | null | undefined,
  locale: string,
  timeZone: string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function formatDate(
  iso: string | null | undefined,
  locale: string,
  timeZone: string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** Money in the organization's currency (USD only in MVP, §25.1). */
export function formatMoney(
  amount: number | null | undefined,
  locale: string,
  currency = "usd",
): string {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat(LOCALE_TAG[locale] ?? "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}
