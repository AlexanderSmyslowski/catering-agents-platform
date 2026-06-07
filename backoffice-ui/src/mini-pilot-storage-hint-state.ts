const MINI_PILOT_STALE_MINUTES = 30;

export interface MiniPilotStorageHintState {
  label?: string;
  isCarryover: boolean;
  isStale: boolean;
}

interface BuildMiniPilotStorageHintStateInput {
  rawResult: string;
  loadedFromStorage: boolean;
  updatedAt?: string;
  now?: Date;
}

function formatUpdatedAt(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function isStaleCarryover(updatedAt: string | undefined, now: Date): boolean {
  if (!updatedAt) {
    return false;
  }

  const updatedAtDate = new Date(updatedAt);
  if (Number.isNaN(updatedAtDate.getTime())) {
    return false;
  }

  return now.getTime() - updatedAtDate.getTime() > MINI_PILOT_STALE_MINUTES * 60_000;
}

export function buildMiniPilotStorageHintState({
  rawResult,
  loadedFromStorage,
  updatedAt,
  now = new Date()
}: BuildMiniPilotStorageHintStateInput): MiniPilotStorageHintState {
  if (!rawResult.trim()) {
    return {
      label: undefined,
      isCarryover: false,
      isStale: false
    };
  }

  const updatedAtLabel = formatUpdatedAt(updatedAt);
  if (!loadedFromStorage) {
    return {
      label: updatedAtLabel
        ? `Lokal gespeichert · zuletzt aktualisiert ${updatedAtLabel}`
        : "Lokal gespeichert",
      isCarryover: false,
      isStale: false
    };
  }

  const stale = isStaleCarryover(updatedAt, now);
  const parts = [
    updatedAtLabel
      ? `Lokaler Stand übernommen · zuletzt aktualisiert ${updatedAtLabel}`
      : "Lokaler Stand übernommen"
  ];

  if (stale) {
    parts.push(`älter als ${MINI_PILOT_STALE_MINUTES} Minuten`);
  }

  return {
    label: parts.join(" · "),
    isCarryover: true,
    isStale: stale
  };
}
