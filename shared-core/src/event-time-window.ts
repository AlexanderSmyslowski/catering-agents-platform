import type { EventScheduleItem } from "./types.js";

/** A clock range is only an event window when its immediate context supports it. */
export function extractEventTimeWindow(text: string): EventScheduleItem[] | undefined {
  if (!/\bvon\s+\d{1,2}/i.test(text)) return undefined;
  const segments = text.split(/\n|[!?;]|\.(?=\s|$)/u);
  const windows: EventScheduleItem[] = [];
  for (const segment of segments) {
    if (/(?:\b(?:nicht|kein(?:e[rsnm]?)?|vielleicht|eventuell|möglicherweise|moeglicherweise|voraussichtlich|gegebenenfalls|alternativ|oder)\b|anliefer|liefer|abhol|erreichbar|sprechzeit|büro|buero|öffnungs|oeffnungs)/iu.test(segment)) continue;
    const matches = [...segment.matchAll(/\bvon\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:Uhr\s*)?bis\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*Uhr\b/gi)];
    if (!/\b(?:veranstaltung|event|feier|hochzeit|buffet|catering|angebot|abendessen|mittagessen|dinner|empfang|fest|party)\b/iu.test(segment) && !/^\s*(?:zeit\s*:\s*)?von\s+\d{1,2}(?::\d{2})?\s*(?:Uhr\s*)?bis\s+\d{1,2}(?::\d{2})?\s*Uhr\s*$/iu.test(segment)) continue;
    for (const match of matches) windows.push({ label: "Zeitfenster", start: `${match[1].padStart(2, "0")}:${match[2] ?? "00"}`, end: `${match[3].padStart(2, "0")}:${match[4] ?? "00"}` });
  }
  const distinct = [...new Map(windows.map((window) => [`${window.start}-${window.end}`, window])).values()];
  return distinct.length === 1 && distinct[0].start! < distinct[0].end! ? distinct : undefined;
}
