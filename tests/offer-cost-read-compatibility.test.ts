import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { calculateOfferPricing, validOfferPricingCalculation } from "../shared-core/src/offer-calculation.js";
import { createBusinessScopedPersistentCollection } from "../shared-core/src/persistence.js";
import type { PricingSummary } from "../shared-core/src/types.js";

type Item = { id: string; businessId: string; version: number; pricingSummary?: PricingSummary; nested?: unknown };
const roots: string[] = [];
const pools: Array<{ end(): Promise<void> }> = [];
afterEach(async () => {
  for (const pool of pools.splice(0)) await pool.end();
  for (const root of roots.splice(0)) {
    try { execFileSync('/usr/bin/trash', [root], { stdio: 'ignore' }); } catch { /* Keep denied synthetic cleanup recoverable. */ }
  }
});
const context = { businessId: "alpha" };
const oldSource = readFileSync(new URL('./fixtures/offer-calculation-reader-ui755.txt', import.meta.url), 'utf8');
const scope = { exports: {} as Record<string, (...args: any[]) => any> };
vm.runInNewContext(ts.transpileModule(oldSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, scope);
const input = { id: "food", label: "SYNTHETISCHES Menü", category: "food", quantity: "100", unit: "guest", unitNetCents: 5800,
  taxRateBps: 1900, sourceKind: "synthetic", sourceReference: "SYNTHETISCHER-100-GAESTE-TEST" };
const costed = calculateOfferPricing({ lines: [{ ...input, directCost: { totalNetCents: 185000, basis: "estimated", estimateDate: "2026-10-25", sourceReference: "SYNTHETISCH: Arbeitswert" } }] }, 100);

function harness(mode: "file" | "postgres") {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'catering-cost-reader-compat-')); roots.push(rootDir);
  const pool = mode === 'postgres' ? new (newDb().adapters.createPg().Pool)() : undefined;
  if (pool) pools.push(pool);
  const collection = createBusinessScopedPersistentCollection<Item>({
    rootDir, pgPool: pool, collectionName: 'compat-test', getId: x => x.id, getVersion: x => x.version,
    validate: value => {
      if (value.pricingSummary && !validOfferPricingCalculation(value.pricingSummary)) throw new Error('Invalid calculation');
      return value;
    }
  });
  const initial: Item = { id: 'record', businessId: 'alpha', version: 1 };
  async function seedFutureRecord(record: Item) {
    await collection.set(context, initial);
    if (pool) await pool.query('UPDATE catering_business_records SET payload=$1::jsonb WHERE business_id=$2 AND collection_name=$3 AND record_id=$4',
      [JSON.stringify(record), 'alpha', 'compat-test', 'record']);
    else writeFileSync(path.join(rootDir, 'businesses/alpha/compat-test/record.json'), JSON.stringify(record), { mode: 0o600 });
  }
  return { collection, initial, seedFutureRecord };
}

describe('read compatibility when enabling cost writes', () => {
  it('pins the actual installed reader and proves both directions of the rollout boundary', () => {
    expect(createHash('sha256').update(oldSource).digest('hex')).toBe('4bd26381f12d583d46d6444a1ec13feb7f11030152bb969a9eaaf1553f24445c');
    expect(scope.exports.validOfferPricingCalculation!(costed)).toBe(false);
    expect(validOfferPricingCalculation(costed)).toBe(true);
    const writable = calculateOfferPricing({ lines: [input] }, 100);
    expect(scope.exports.validOfferPricingCalculation!(writable)).toBe(true);
    expect(writable.calculation?.lines[0]).not.toHaveProperty('directCost');
    expect(writable.calculation).toEqual(scope.exports.calculateOfferPricing!({ lines: [input] }, 100).calculation);
  });

  it('keeps a large legacy array writable without argument-spread overflow', async () => {
    const { collection, initial } = harness('file');
    const large = { ...initial, nested: Array.from({ length: 160000 }, () => 0) };
    await collection.insert(context, large);
    expect((await collection.get(context, 'record'))?.nested).toHaveLength(160000);
  });

  describe.each(['file', 'postgres'] as const)('%s storage', mode => {
    it.each(['set', 'insert', 'insertWithResult', 'compareAndSet', 'compareAndSetExact'] as const)('enables %s with intact costs after the compatible reader is established', async method => {
      const { collection, initial } = harness(mode);
      const isCompare = method === 'compareAndSet' || method === 'compareAndSetExact';
      if (isCompare) await collection.set(context, initial);
      const next: Item = { ...initial, version: 2, pricingSummary: costed };
      if (method === 'compareAndSet') expect(await collection.compareAndSet(context, 'record', 1, next)).toBe('updated');
      else if (method === 'compareAndSetExact') expect(await collection.compareAndSetExact(context, 'record', initial, next)).toBe('updated');
      else await collection[method](context, next);
      expect(await collection.get(context, 'record')).toEqual(next);
      expect(await collection.list(context)).toEqual([next]);
    });
    it('retains unrelated legacy metadata using the same property name', async () => {
      const { collection, initial } = harness(mode);
      const legacy = { ...initial, nested: { directCost: 'legacy unrelated text' } };
      await collection.insert(context, legacy);
      expect(await collection.get(context, 'record')).toEqual(legacy);
    });
    it('reads a future-version record and preserves costs when publishing its next revision', async () => {
      const { collection, initial, seedFutureRecord } = harness(mode);
      const future = { ...initial, pricingSummary: costed };
      await seedFutureRecord(future);
      expect(await collection.get(context, 'record')).toEqual(future);
      const next = { ...future, version: 2 };
      expect(await collection.compareAndSet(context, 'record', 1, next)).toBe('updated');
      expect(await collection.get(context, 'record')).toEqual(next);
      expect(future).toEqual({ ...initial, pricingSummary: costed });
    });
  });
});
