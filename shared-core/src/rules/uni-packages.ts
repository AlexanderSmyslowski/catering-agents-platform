import { readFileSync } from "node:fs";

export const UNI_STAFF_HOURLY = 45.55;

export interface UniRequestPackage {
  id: string;
  name: string;
  price_band_pp: [number, number];
  min_pax?: number;
  food_modules?: string[];
  service_modules?: string[];
  event_types: string[];
  cluster: string;
  source_evidence: unknown;
  premium_variant?: {
    name: string;
    price_band_pp: [number, number];
  };
}

export interface SelectUniPackagesInput {
  eventType?: string;
  pax: number;
}

export interface EstimateUniSideCostsInput {
  deliveries: number;
  staffHours: number;
}

export interface UniSideCostsEstimate {
  transport: number;
  staff: number;
  total: number;
}

const UNI_PACKAGES_URL = new URL("../fixtures/uni-request-packages.json", import.meta.url);

let uniPackageCache: UniRequestPackage[] | undefined;

export function loadUniRequestPackages(): UniRequestPackage[] {
  uniPackageCache ??= JSON.parse(readFileSync(UNI_PACKAGES_URL, "utf8")) as UniRequestPackage[];
  return uniPackageCache;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

function eventTypeMatches(query: string, packageEventType: string): boolean {
  const normalizedQuery = normalized(query);
  const normalizedPackageEventType = normalized(packageEventType);
  return normalizedPackageEventType.includes(normalizedQuery);
}

export function selectUniPackages(input: SelectUniPackagesInput): UniRequestPackage[] {
  const eventType = input.eventType?.trim();

  return loadUniRequestPackages().filter((packagePreset) => {
    if (packagePreset.min_pax !== undefined && packagePreset.min_pax > input.pax) {
      return false;
    }

    if (!eventType) {
      return true;
    }

    return packagePreset.event_types.some((packageEventType) =>
      eventTypeMatches(eventType, packageEventType)
    );
  });
}

function transportForDeliveries(deliveries: number): number {
  if (deliveries <= 0) {
    return 0;
  }
  if (deliveries === 1) {
    return 150;
  }
  if (deliveries === 2) {
    return 300;
  }
  if (deliveries === 3) {
    return 450;
  }
  return 600;
}

function roundCurrency(value: number): number {
  return Math.round(Number(value.toFixed(3)) * 100) / 100;
}

export function estimateUniSideCosts(input: EstimateUniSideCostsInput): UniSideCostsEstimate {
  const transport = transportForDeliveries(input.deliveries);
  // RV-Zuschlagssatz 42,02 €/h, individuelle Anpassung — Klärung offen.
  const staff = roundCurrency(input.staffHours * UNI_STAFF_HOURLY);

  return {
    transport,
    staff,
    total: roundCurrency(transport + staff)
  };
}
