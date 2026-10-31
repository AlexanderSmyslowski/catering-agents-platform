import type { OfferDraft } from "@catering/shared-core";
import { formatEventTypeLabel, formatServiceFormLabel } from "@catering/shared-core";
import { formatDocumentDate } from "./document-labels.js";
import { renderOfferPricingHtml } from "./offer-pricing-html.js";

const escape = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// A customer layout is a preview, not a publication decision. Keep free-form
// working text, source evidence and automatic service suggestions out of it.
export function renderCustomerOfferPreview(draft: OfferDraft): string {
  const spec = draft.proposedEventSpec;
  return [
    '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CateringOS · Kundenentwurf</title>',
    `<style>
      @page{size:A4;margin:18mm}
      *{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:15px;line-height:1.5}
      main{max-width:900px;margin:32px auto;padding:32px;background:#fff}header{padding-bottom:20px;border-bottom:1px solid #d2d2d7}
      h1{font-size:30px;line-height:1.15;margin:0 0 12px}h2{font-size:20px;line-height:1.3;margin:28px 0 12px}p{margin:6px 0}
      .draft-notice{padding:12px 0;color:#515154}.draft-notice strong{color:#1d1d1f}ul{padding-left:20px}li{margin:5px 0;overflow-wrap:anywhere}
      table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:10px 8px;border-bottom:1px solid #d2d2d7}th{font-size:13px;color:#515154}
      .money,.quantity{white-space:nowrap;font-variant-numeric:tabular-nums}.offer-pricing__gross{font-size:20px;font-weight:600;text-align:right;margin-top:16px}td:first-child{overflow-wrap:anywhere}footer{margin-top:28px;padding-top:16px;border-top:1px solid #d2d2d7;font-size:13px;color:#515154}
      @media screen and (max-width:600px){main{margin:0;padding:24px 16px}h1{font-size:26px}thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}tbody,tr,td{display:block}tr{padding:12px 0;border-bottom:1px solid #d2d2d7}td{display:flex;justify-content:space-between;gap:16px;border:0;padding:4px 0}td::before{content:attr(data-label);font-size:13px;color:#515154;flex:0 0 42%}}
      @media print{body{background:#fff;font-size:11px}main{margin:0;padding:0;max-width:none}h1{font-size:23px}h2{font-size:16px;break-after:avoid-page}tr,header{break-inside:avoid-page}footer{font-size:10px}}
    </style></head><body><main>`,
    '<header><h1>Kundenentwurf</h1><p class="draft-notice"><strong>Vorschau · nicht zum Versand freigegeben.</strong> Diese Ansicht zeigt die Gestaltung für den Kunden. Sie ersetzt keine fachliche Freigabe.</p>',
    `<p>Kunde: ${escape(spec.customer?.name ?? "offen")}</p>`,
    `<p>Veranstaltung: ${escape(spec.event?.title ?? formatEventTypeLabel(spec.event?.type) ?? "offen")}</p>`,
    `<p>Datum: ${escape(formatDocumentDate(spec.event?.date))} · Gäste: ${escape(spec.attendees?.expected ?? "offen")}</p>`,
    `<p>Serviceform: ${escape(formatServiceFormLabel(spec.event?.serviceForm ?? spec.servicePlan?.serviceForm) ?? "offen")}</p>`,
    ...(spec.venue ? [`<p>Veranstaltungsort: ${escape([spec.venue.name, spec.venue.address].filter(Boolean).join(" · ") || "offen")}</p>`] : []),
    ...(spec.event?.schedule?.map(slot => `<p>${escape(slot.label)}: ${escape(slot.start ?? "offen")}–${escape(slot.end ?? "offen")}</p>`) ?? []),
    "</header>",
    ...(spec.menuPlan?.length ? ["<section><h2>Menü</h2><ul>", ...spec.menuPlan.map(item => `<li>${escape(item.label)} · ${item.servings === undefined ? "Portionszahl offen" : `${escape(item.servings)} Portionen`}</li>`), "</ul></section>"] : []),
    renderOfferPricingHtml(draft.pricingSummary, false),
    '<footer>Entwurf zur Prüfung. Leistungsumfang, Preise, Steuer und besondere Ernährungsanforderungen vor dem Versand verbindlich klären.</footer>',
    "</main></body></html>"
  ].join("");
}
