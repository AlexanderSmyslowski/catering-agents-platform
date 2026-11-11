import { fetchJson } from "./api.js";
import type { PriceColumns } from "./price-source-columns.js";

const base = "/api/offers/v1/offers/supplier-sources";
const post = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});
export type Sample = { uidValidity: string; uid: number; part: string };
export type SampleMessage = {
  uidValidity: string;
  uid: number;
  from: string;
  subject: string;
  attachments: { part: string; filename: string }[];
};
export type SourceConfig = {
  name: string;
  mailboxId: string;
  sender: string;
  subject?: string;
  columns: { headerRow: number; columns: PriceColumns; headers: PriceColumns };
  autoApply: boolean;
  articleMappings?: ArticleMapping[];
};
export type PriceSource = {
  id: string;
  active: boolean;
  configVersion: number;
  config: SourceConfig;
  pendingCount: number;
  pollStatus?: "stalled" | null;
  poll?: { status: "ok" | "stalled" } | null;
};
export type PriceRow = {
  article: string;
  description: string;
  quantity: string;
  unit: string;
  price: string;
};
export type Preview = {
  sourceVersion?: number;
  configVersion?: number;
  id: string;
  rows: PriceRow[];
  removedArticles?: string[];
  appliedArticles?: string[];
  appliedAt?: string;
  createdAt: string;
  validFrom?: string;
  senderAuthenticated?: boolean;
  skipped?: Array<{ row: number; reason: string; article?: string }>;
};
export type SourcePrice = PriceRow & {
  sourceId: string;
  sourceName: string;
  ingredientKey: string;
  validFrom?: string;
  observedAt: string;
};
export type ArticleMapping = {
  rawQuantity?: string;
  rawUnit?: string;
  article: string;
  ingredientKey: string;
  quantity: string;
  unit: string;
};
export const priceSourceApi = {
  sources: () => fetchJson<{ sources: PriceSource[] }>(base),
  mailboxes: () =>
    fetchJson<{ mailboxes: { id: string; label: string }[] }>(
      base + "/mailboxes",
    ),
  messages: (id: string, sender: string) =>
    fetchJson<{ messages: SampleMessage[] }>(
      base +
        "/mailboxes/" +
        encodeURIComponent(id) +
        "/messages?sender=" +
        encodeURIComponent(sender),
    ),
  headers: (id: string, sample: Sample, sender: string) =>
    fetchJson<{ rows: Array<{ row: number; cells: Record<string, string> }> }>(
      base + "/mailboxes/" + encodeURIComponent(id) + "/columns",
      post({ ...sample, sender }),
    ),
  configure: (
    id: string,
    config: SourceConfig,
    expectedConfigVersion: number,
  ) =>
    fetchJson<{ source: PriceSource }>(base + "/" + encodeURIComponent(id), {
      ...post({ ...config, expectedConfigVersion }),
      method: "PUT",
    }),
  create: (config: SourceConfig) =>
    fetchJson<{ source: PriceSource }>(
      base,
      post({ ...config, articleMappings: [] }),
    ),
  preview: (id: string, sample: Sample) =>
    fetchJson<{ preview: Preview }>(
      base + "/" + encodeURIComponent(id) + "/preview",
      post(sample),
    ),
  activate: (
    id: string,
    previewId: string,
    articleMappings: ArticleMapping[],
    removedArticles: string[],
    expectedConfigVersion: number,
    expectedSourceVersion: number | undefined,
  ) =>
    fetchJson<unknown>(
      base + "/" + encodeURIComponent(id) + "/activate",
      post({
        previewId,
        articleMappings,
        removedArticles,
        expectedConfigVersion,
        expectedSourceVersion,
      }),
    ),
  pause: (id: string) =>
    fetchJson(base + "/" + encodeURIComponent(id) + "/pause", post({})),
  discard: (
    id: string,
    previewId: string,
    expectedConfigVersion: number,
    expectedSourceVersion: number | undefined,
  ) =>
    fetchJson(
      base +
        "/" +
        encodeURIComponent(id) +
        "/previews/" +
        encodeURIComponent(previewId) +
        "/discard",
      post({ expectedConfigVersion, expectedSourceVersion }),
    ),
  pending: (id: string) =>
    fetchJson<{
      previews: Array<Pick<Preview, "id" | "createdAt"> & { rowCount: number }>;
    }>(base + "/" + encodeURIComponent(id) + "/previews"),
  pendingPreview: (id: string, previewId: string) =>
    fetchJson<{ preview: Preview }>(
      base +
        "/" +
        encodeURIComponent(id) +
        "/previews/" +
        encodeURIComponent(previewId),
    ),
  prices: (ingredient: string) =>
    fetchJson<{ prices: SourcePrice[] }>(
      base + "/prices?ingredient=" + encodeURIComponent(ingredient),
    ),
};
