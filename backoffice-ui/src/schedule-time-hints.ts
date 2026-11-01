/**
 * Presentation helper for clock times that appear twice: once as a confirmed
 * schedule slot (event.schedule) and once as an unverified request hint
 * ("Zeit-/Logistikangabe aus Anfrage (ungeprüft): …").
 *
 * Only a true duplicate is combined: a hint that consists of exactly one
 * labelled time range whose label, start and end equal a confirmed slot.
 * Hints with other values, several facts, durations or no clear label stay
 * visible as unverified. Nothing is confirmed by parsing; stored data and
 * print/export contracts are unchanged.
 */

export const UNVERIFIED_TIME_PREFIX = "Zeit-/Logistikangabe aus Anfrage (ungeprüft): ";

export type ScheduleSlotLike = { label?: unknown; start?: unknown; end?: unknown };

type TimeRange = { label: string; start: string; end: string };

function normalizeClock(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const label = value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
  return label || undefined;
}

/** "Empfang 18:00–19:00", "Abendbuffet 19:00 - 21:00 Uhr." → one range; else undefined. */
export function parseSingleTimeRangeHint(hint: string): TimeRange | undefined {
  const match = /^([^\d,;:()]+?)\s+(\d{1,2}[:.]\d{2})\s*(?:Uhr\s*)?(?:–|—|-|bis)\s*(\d{1,2}[:.]\d{2})\s*(?:Uhr)?\s*\.?$/u.exec(hint.trim());
  if (!match) return undefined;
  const label = normalizeLabel(match[1]);
  const start = normalizeClock(match[2]);
  const end = normalizeClock(match[3]);
  return label && start && end ? { label, start, end } : undefined;
}

function slotRange(slot: ScheduleSlotLike): TimeRange | undefined {
  const label = normalizeLabel(slot.label);
  const start = normalizeClock(slot.start);
  const end = normalizeClock(slot.end);
  return label && start && end ? { label, start, end } : undefined;
}

/** Index of the confirmed slot that the hint duplicates exactly, or -1. */
export function confirmedSlotIndexForHint(hint: string, schedule: readonly ScheduleSlotLike[] | undefined): number {
  const parsed = parseSingleTimeRangeHint(hint);
  if (!parsed || !schedule) return -1;
  return schedule.findIndex((slot) => {
    const range = slotRange(slot);
    return Boolean(range && range.label === parsed.label && range.start === parsed.start && range.end === parsed.end);
  });
}

export type ScheduleHintPartition = {
  /** Unverified hints that are not exact duplicates of a confirmed slot. */
  openHints: string[];
  /** Confirmed slot indexes that the request also named with the same time. */
  matchedSlotIndexes: Set<number>;
};

export function partitionTimeHints(hints: readonly string[], schedule: readonly ScheduleSlotLike[] | undefined): ScheduleHintPartition {
  const openHints: string[] = [];
  const matchedSlotIndexes = new Set<number>();
  for (const hint of hints) {
    const index = confirmedSlotIndexForHint(hint, schedule);
    if (index >= 0) matchedSlotIndexes.add(index);
    else openHints.push(hint);
  }
  return { openHints, matchedSlotIndexes };
}

/** Raw kitchen-note strings with an exact confirmed duplicate removed. The
 * schedule note itself ("Empfang: 18:00–19:00") stays as the single entry. */
export function withoutConfirmedTimeDuplicates(notes: readonly string[], schedule: readonly ScheduleSlotLike[] | undefined): string[] {
  return notes.filter((note) => !(note.startsWith(UNVERIFIED_TIME_PREFIX) &&
    confirmedSlotIndexForHint(note.slice(UNVERIFIED_TIME_PREFIX.length), schedule) >= 0));
}
