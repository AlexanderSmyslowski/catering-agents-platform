import { mkdtempSync, rmSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  createEventRequestFromManualForm,
  createEventRequestFromText,
  internalRecipes,
  normalizeEventRequestToSpec,
  type EventRequest,
  type Recipe
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  buildProductionArtifacts,
  type WebRecipeSearchProvider
} from "@catering/production-service";

class EmptyWebProvider implements WebRecipeSearchProvider {
  async searchRecipes() {
    return [];
  }
}

type CliMode = "text" | "manual";

type ParsedArgs = {
  mode: CliMode;
  json: boolean;
  text?: string;
  eventType?: string;
  eventDate?: string;
  attendeeCount?: number;
  serviceForm?: string;
  menuItems?: string[];
  customerName?: string;
  venueName?: string;
  notes?: string;
};

type CliRunResult = {
  mode: CliMode;
  request: EventRequest;
  spec: ReturnType<typeof normalizeEventRequestToSpec>;
  productionPlan: Awaited<ReturnType<typeof buildProductionArtifacts>>["productionPlan"];
  purchaseList: Awaited<ReturnType<typeof buildProductionArtifacts>>["purchaseList"];
};

function createTempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-cli-"));
}

function parseNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseList(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const parsed: ParsedArgs = {
    mode: "text",
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    switch (current) {
      case "--json":
        parsed.json = true;
        break;
      case "--manual":
        parsed.mode = "manual";
        break;
      case "--text":
        parsed.mode = "text";
        parsed.text = args[++index];
        break;
      case "--event-type":
        parsed.eventType = args[++index];
        break;
      case "--date":
        parsed.eventDate = args[++index];
        break;
      case "--attendees":
        parsed.attendeeCount = parseNumber(args[++index]);
        break;
      case "--service-form":
        parsed.serviceForm = args[++index];
        break;
      case "--menu":
        parsed.menuItems = [...(parsed.menuItems ?? []), ...(parseList(args[++index]) ?? [])];
        break;
      case "--customer":
        parsed.customerName = args[++index];
        break;
      case "--venue":
        parsed.venueName = args[++index];
        break;
      case "--notes":
        parsed.notes = args[++index];
        break;
      default:
        if (!current.startsWith("--") && parsed.mode === "text" && !parsed.text) {
          parsed.text = [current, ...args.slice(index + 1)].join(" ");
          index = args.length;
        }
        break;
    }
  }

  return parsed;
}

async function readAllStdin(): Promise<string> {
  if (stdin.isTTY) {
    return "";
  }

  const chunks: string[] = [];
  for await (const chunk of stdin) {
    chunks.push(String(chunk));
  }

  return chunks.join("").trim();
}

async function promptForArgs(parsed: ParsedArgs): Promise<ParsedArgs> {
  if (!stdin.isTTY) {
    if (parsed.mode === "text" && !parsed.text) {
      parsed.text = await readAllStdin();
    }
    return parsed;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    if (parsed.mode === "manual") {
      if (!parsed.eventType) {
        parsed.eventType = (await rl.question("Eventtyp (optional): ")).trim() || undefined;
      }
      if (!parsed.eventDate) {
        parsed.eventDate = (await rl.question("Datum (YYYY-MM-DD, optional): ")).trim() || undefined;
      }
      if (parsed.attendeeCount === undefined) {
        parsed.attendeeCount = parseNumber((await rl.question("Teilnehmerzahl (optional): ")).trim());
      }
      if (!parsed.serviceForm) {
        parsed.serviceForm = (await rl.question("Serviceform (optional): ")).trim() || undefined;
      }
      if (!parsed.menuItems || parsed.menuItems.length === 0) {
        parsed.menuItems = parseList((await rl.question("Menüpunkte, komma-separiert (optional): ")).trim());
      }
      if (!parsed.notes) {
        parsed.notes = (await rl.question("Notizen / Hinweise (optional): ")).trim() || undefined;
      }
      if (!parsed.customerName) {
        parsed.customerName = (await rl.question("Kundenname (optional): ")).trim() || undefined;
      }
      if (!parsed.venueName) {
        parsed.venueName = (await rl.question("Ort / Venue (optional): ")).trim() || undefined;
      }
    } else if (!parsed.text) {
      parsed.text = (await rl.question("Freitext-Anfrage: ")).trim();
    }
  } finally {
    rl.close();
  }

  return parsed;
}

function createRecipeRepository(rootDir: string): InMemoryRecipeRepository {
  return new InMemoryRecipeRepository(internalRecipes, { rootDir });
}

async function runFlow(parsed: ParsedArgs): Promise<CliRunResult> {
  const tempRoot = createTempRoot();
  try {
    const repository = createRecipeRepository(tempRoot);
    const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());

    const request =
      parsed.mode === "manual"
        ? createEventRequestFromManualForm({
            requestId: `cli-${Date.now()}`,
            eventType: parsed.eventType,
            eventDate: parsed.eventDate,
            attendeeCount: parsed.attendeeCount,
            serviceForm: parsed.serviceForm,
            menuItems: parsed.menuItems,
            customerName: parsed.customerName,
            venueName: parsed.venueName,
            notes: parsed.notes
          })
        : createEventRequestFromText({
            requestId: `cli-${Date.now()}`,
            channel: "text",
            rawText: parsed.text?.trim() || ""
          });

    const spec = normalizeEventRequestToSpec(request);
    const plannedSpec = {
      ...spec,
      menuPlan: spec.menuPlan.map((item) => ({
        ...item,
        productionDecision: {
          mode: "scratch" as const
        }
      }))
    };
    const artifacts = await buildProductionArtifacts(plannedSpec, discovery);

    return {
      mode: parsed.mode,
      request,
      spec,
      productionPlan: artifacts.productionPlan,
      purchaseList: artifacts.purchaseList
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function formatList(values: string[], emptyLabel = "- keine"): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : emptyLabel;
}

function formatHumanReadable(result: CliRunResult): string {
  const { spec, productionPlan, purchaseList, request, mode } = result;
  const assumptions = spec.assumptions?.map((item) => `${item.code}: ${item.message}`) ?? [];
  const uncertainties = spec.uncertainties?.map((item) => `${item.field}: ${item.message}`) ?? [];
  const blockingIssues = productionPlan.blockingIssues ?? [];
  const warnings = productionPlan.warnings ?? [];
  const batches = productionPlan.productionBatches;
  const kitchenSheets = productionPlan.kitchenSheets;
  const topPurchaseItems = purchaseList.items.slice(0, 12).map((item) => {
    const qty = `${item.purchaseQty} ${item.purchaseUnit}`;
    return `- ${item.displayName} — ${qty} (${item.group})`;
  });

  return [
    "# Catering-Agenten MVP CLI",
    `Modus: ${mode}`,
    `Anfrage: ${request.requestId}`,
    `Intake-Readiness: ${spec.readiness.status}`,
    spec.readiness.reasons?.length ? `Intake-Hinweise: ${spec.readiness.reasons.join(" | ")}` : undefined,
    assumptions.length > 0 ? `Annahmen:\n${formatList(assumptions)}` : "Annahmen: - keine",
    uncertainties.length > 0 ? `Unsicherheiten:\n${formatList(uncertainties)}` : "Unsicherheiten: - keine",
    `Planungs-Readiness: ${productionPlan.readiness.status}`,
    productionPlan.isFallback ? `Planung abgebrochen wegen: ${productionPlan.fallbackReason ?? "unbekanntem Grund"}` : "Planung: erfolgreich",
    blockingIssues.length > 0 ? `Blocking-Issues:\n${formatList(blockingIssues)}` : "Blocking-Issues: - keine",
    warnings.length > 0 ? `Warnungen:\n${formatList(warnings)}` : "Warnungen: - keine",
    `Produktionsbatches (${batches.length}):`,
    batches.length > 0
      ? batches
          .map(
            (batch) =>
              `- ${batch.batchId} | Rezept: ${batch.recipeId} | Station: ${batch.station} | Vorlauf: ${batch.prepWindow}`
          )
          .join("\n")
      : "- keine",
    `Küchenblätter (${kitchenSheets.length}):`,
    kitchenSheets.length > 0
      ? kitchenSheets.map((sheet) => `- ${sheet.title}`).join("\n")
      : "- keine",
    `Einkaufsliste (${purchaseList.items.length} Positionen):`,
    topPurchaseItems.length > 0 ? topPurchaseItems.join("\n") : "- keine",
    purchaseList.items.length > topPurchaseItems.length
      ? `- … und ${purchaseList.items.length - topPurchaseItems.length} weitere Positionen`
      : undefined,
    `Gesamtmenge Positionen: ${purchaseList.totals.itemCount}`,
    `Gesamtgruppe(n): ${purchaseList.totals.groups.length}`
  ]
    .filter(Boolean)
    .join("\n");
}

async function main(): Promise<void> {
  const parsed = await promptForArgs(parseArgs(process.argv));

  if (parsed.mode === "text" && !parsed.text?.trim()) {
    console.error("Bitte entweder --text angeben oder im interaktiven Modus eine Freitext-Anfrage eingeben.");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runFlow(parsed);

    if (parsed.json) {
      console.log(
        JSON.stringify(
          {
            mode: result.mode,
            request: result.request,
            spec: result.spec,
            productionPlan: result.productionPlan,
            purchaseList: result.purchaseList
          },
          null,
          2
        )
      );
    } else {
      console.log(formatHumanReadable(result));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MVP-CLI konnte die Anfrage nicht ausführen: ${message}`);
    process.exitCode = 1;
  }
}

void main();
