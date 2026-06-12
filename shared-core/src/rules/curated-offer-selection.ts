import { readFileSync } from "node:fs";
import type { AcceptedEventSpec } from "../types.js";
import type { CuratedOfferPackagePreset } from "./offer.js";

export interface CuratedOfferPackage extends CuratedOfferPackagePreset {
  event_types: string[];
  cluster: string;
  review_status: unknown;
}

interface PackageSelectionRule {
  eventType: string;
  serviceForm?: string;
  packageId: string;
}

const CURATED_PACKAGES_URL = new URL("../fixtures/curated-offer-packages.json", import.meta.url);

const PACKAGE_SELECTION_RULES: PackageSelectionRule[] = [
  { eventType: "lunch", packageId: "business_lunch_basic" },
  { eventType: "meeting", serviceForm: "buffet", packageId: "business_lunch_basic" },
  { eventType: "conference", packageId: "conference_day_catering" },
  { eventType: "reception", serviceForm: "standing_reception", packageId: "reception_fingerfood_basic" },
  { eventType: "reception", serviceForm: "buffet", packageId: "flying_buffet_premium" },
  { eventType: "dinner", serviceForm: "buffet", packageId: "private_buffet_classic" }
];

let packageCache: CuratedOfferPackage[] | undefined;

export function loadCuratedOfferPackages(): CuratedOfferPackage[] {
  packageCache ??= JSON.parse(readFileSync(CURATED_PACKAGES_URL, "utf8")) as CuratedOfferPackage[];
  return packageCache;
}

function ruleMatches(rule: PackageSelectionRule, spec: AcceptedEventSpec): boolean {
  if (spec.servicePlan.eventType !== rule.eventType) {
    return false;
  }
  return rule.serviceForm === undefined || spec.servicePlan.serviceForm === rule.serviceForm;
}

export function selectCuratedPackage(spec: AcceptedEventSpec): CuratedOfferPackage | undefined {
  const attendeeCount = spec.attendees.expected;
  if (attendeeCount === undefined) {
    return undefined;
  }

  const rule = PACKAGE_SELECTION_RULES.find((entry) => ruleMatches(entry, spec));
  if (!rule) {
    return undefined;
  }

  const packagePreset = loadCuratedOfferPackages().find((entry) => entry.id === rule.packageId);
  if (!packagePreset || attendeeCount < (packagePreset.min_pax ?? 0)) {
    return undefined;
  }

  return packagePreset;
}
