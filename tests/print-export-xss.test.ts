import { describe, expect, it } from "vitest";
import type { OfferDraft, ProductionPlan } from "@catering/shared-core";
import { renderOfferHtml, renderProductionPlanHtml } from "@catering/print-export";

const maliciousText = `<script>alert("xss")</script><img src=x onerror="alert('xss')"><b data-x="1">bold</b> "quoted" & 'single'`;

function minimalOfferDraft(overrides: Partial<OfferDraft> = {}): OfferDraft {
  return {
    schemaVersion: "1.0.0",
    businessId: "local",
    draftId: `draft-${maliciousText}`,
    revision: 1,
    eventSummary: `Summary ${maliciousText}`,
    serviceModules: [
      {
        moduleId: "module-1",
        label: `Module ${maliciousText}`,
        category: "test",
        pricing: { amount: 10, currency: "EUR" }
      }
    ],
    pricingSummary: {
      subtotal: { amount: 10, currency: "EUR" }
    },
    assumptions: [],
    openQuestions: [`Question ${maliciousText}`],
    variantSet: [],
    customerFacingText: `Customer ${maliciousText}`,
    internalWorkingText: "Internal",
    proposedEventSpec: {} as OfferDraft["proposedEventSpec"],
    ...overrides
  };
}

function minimalProductionPlan(): ProductionPlan {
  return {
    schemaVersion: "1.0.0",
    planId: `plan-${maliciousText}`,
    eventSpecId: "event-1",
    readiness: {
      status: "partial",
      reasons: []
    },
    productionBatches: [
      {
        batchId: "batch-1",
        componentId: `Component ${maliciousText}`,
        recipeId: "recipe-1",
        scaledYield: { amount: 10, unit: "portion" },
        batchCount: 1,
        lossFactor: 1,
        gnPlan: [],
        station: `Station ${maliciousText}`,
        prepWindow: "08:00-10:00",
        ingredients: [],
        steps: [
          {
            index: 1,
            instruction: `Step ${maliciousText}`
          }
        ]
      }
    ],
    timeline: [],
    kitchenSheets: [],
    recipeSelections: [],
    unresolvedItems: [`Unresolved ${maliciousText}`]
  };
}

describe("print export HTML escaping", () => {
  it("escapes data-driven offer HTML text so tags, event attributes, and quotes are inert", () => {
    const html = renderOfferHtml(
      minimalOfferDraft({
        reviewStatus: {
          priceReviewStatus: "verified",
          taxReviewStatus: "verified",
          allergenReviewStatus: "verified",
          hygieneTemperatureReviewStatus: "verified",
          sourceSecured: true,
          publishApproved: true
        }
      })
    );

    expect(html).toContain("<h1>Angebot</h1>");
    expect(html).not.toContain("Angebot draft-");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;");
    expect(html).toContain("&lt;b data-x=&quot;1&quot;&gt;bold&lt;/b&gt; &quot;quoted&quot; &amp; &#39;single&#39;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).not.toContain("<b data-x=");
    expect(html).not.toContain('"quoted" & \'single\'');
  });

  it("keeps unapproved offer customer text out of the HTML export", () => {
    const html = renderOfferHtml(
      minimalOfferDraft({
        customerFacingText: `Customer should stay gated ${maliciousText}`,
        internalWorkingText: "Internal review notes",
        reviewStatus: {
          priceReviewStatus: "review_required",
          taxReviewStatus: "review_required",
          allergenReviewStatus: "review_required",
          hygieneTemperatureReviewStatus: "review_required",
          sourceSecured: true,
          publishApproved: false
        }
      })
    );

    expect(html).toContain("Interne Prüfung");
    expect(html).toContain("Kundentext erst nach Publish-Freigabe exportieren.");
    expect(html).toContain("Preis: Prüfung nötig");
    expect(html).toContain("MwSt.: Prüfung nötig");
    expect(html).toContain("Allergene: Prüfung nötig");
    expect(html).toContain("Hygiene/Temperatur: Prüfung nötig");
    expect(html).not.toContain("review_required");
    expect(html).not.toContain("Internal review notes");
    expect(html).not.toContain("Customer should stay gated");
  });

  it("escapes data-driven production HTML text so tags, event attributes, and quotes are inert", () => {
    const html = renderProductionPlanHtml(minimalProductionPlan());

    expect(html).toContain("<h1>Produktionsplan</h1>");
    expect(html).toContain("Status: teilweise vollständig");
    expect(html).not.toContain("Status: partial");
    expect(html).toContain("Arbeitsdokument – Mengen, Allergene und Preise vor Produktion prüfen.");
    expect(html).not.toContain("Produktionsplan plan-");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;");
    expect(html).toContain("&lt;b data-x=&quot;1&quot;&gt;bold&lt;/b&gt; &quot;quoted&quot; &amp; &#39;single&#39;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).not.toContain("<b data-x=");
    expect(html).not.toContain('"quoted" & \'single\'');
  });

  it("renders safe read-only provenance anchors on production plan exports when present", () => {
    const plan = {
      ...minimalProductionPlan(),
      sourceAnchors: [
        {
          filename: "angebot-pa4.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          sha256Short: "123456789abc",
          ingestedAt: "2026-05-21T09:15:00.000Z",
          uploadContext: "intake"
        }
      ],
      rawSourceText: "Dieser Rohtext darf nicht im Export erscheinen."
    } as unknown as ProductionPlan;

    const html = renderProductionPlanHtml(plan);

    expect(html).toContain("Quellenanker");
    expect(html).toContain("angebot-pa4.pdf · application/pdf · 2.0 KB · sha256:123456789abc · intake · 2026-05-21T09:15:00.000Z");
    expect(html).not.toContain("Dieser Rohtext");
  });
});
