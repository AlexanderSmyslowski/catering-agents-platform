import { isDeepStrictEqual } from "node:util";

function normalizeJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

export function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(normalizeJsonValue(left), normalizeJsonValue(right));
}
