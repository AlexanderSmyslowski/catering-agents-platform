# Nonlinear Production Scaling & Experience Learning v1 — TDD Evidence

## RED evidence

The slice was implemented through separate RED→GREEN contracts rather than one large unverified change.

1. **Nonlinear scaling contract**
   - RED head: `ffb6b2224ed46d1e8ee54caf4a77d38ff592fd43`
   - CI: `32072697911` (#2503)
   - Expected failure: shared-core did not export `applyNonlinearProductionScaling` or `ProductionScalingRule`; dependent implicit-any errors were consequences of those missing types.

2. **Production observation → Experience Rule Candidate**
   - RED head included `tests/experience-learning.test.ts` before the experience-learning implementation.
   - CI: `32072886662` (#2506)
   - Expected failure: missing Experience Learning public contract.

3. **Human approval + evidence strength**
   - RED test commit: `a778b09f6928db921be27df6e60b1c2c3f448d32`
   - CI: `32073104219` (#2509)
   - Expected failure: approval/evidence functions were not yet implemented.

4. **Quantity override → nonlinear effective recipe integration**
   - RED test commit: `56336663725181731a122b5697aa696082c558b4`
   - CI: `32073289093` (#2511)
   - Expected failure: recalculation did not yet consume separately reviewed quantity authority or nonlinear production rules.

## Integration correction

The first combined GREEN attempt on head `66dfa2e82dfb63fda206dbdad9e2d30581b59e3b` correctly exposed that the existing Quantity→Recipe Bridge also requires Recipe Event Use approval when the recipe itself is not fully production-ready through durable knowledge verification.

The fix did not weaken any gate. `recalculateQuantityLineage()` now accepts the existing `RecipeEventUseReview` contract and passes it through to the existing bridge. Nonlinear production scaling therefore becomes effective only after:

1. the new event quantity has been separately approved;
2. recipe use is production-eligible or explicitly accepted for the event under the existing recipe gate;
3. the nonlinear Experience Rule itself is human-approved and applicable.

## GREEN evidence

- GREEN head before this evidence document: `7a578418f439fad2aa686779c356b666bf01afd8`
- CI: `32073991316` (#2514)
- `build-and-test`: SUCCESS
- `browser-rehearsal`: SUCCESS
- Full Vitest suite:
  - 344 test files passed
  - 1 test file skipped
  - 2,103 tests passed
  - 14 tests skipped
  - 0 failures
- Focused new contracts included in that full run:
  - `tests/nonlinear-production-scaling.test.ts`: 15/15 passed
  - `tests/experience-learning.test.ts`: 14/14 passed
  - `tests/user-quantity-override.test.ts`: 10/10 passed
- Existing neighboring contracts remained green, including Quantity Recommendation, Quantity Decision, Quantity→Recipe Bridge and ProductionBatch Materialization.

## Contract delivered

- Proportional `scaleRecipe()` remains the transparent baseline.
- Only exact-recipe, exact-ingredient, in-range, context-compatible `approved` nonlinear rules can alter effective production quantities.
- `factor`, `cap`, `floor` and exact-size `anchor` corrections are supported in v1.
- Conflicting approved rules fail closed for the affected ingredient.
- Candidate/rejected/superseded/revoked rules never auto-apply.
- One valid production observation may create an Experience Rule Candidate.
- Human approval has no artificial minimum observation count.
- Evidence strength remains separate from approval and exposes confirming/contradicting observations and range coverage.
- Contradicting evidence triggers review need without silently revoking an approved rule.
- Purchasing is derived from the effective recipe after all existing quantity/recipe gates pass.
- No hidden safety, yield, loss, procurement or overproduction multiplier was introduced.

## Non-goals confirmed

No persistence migration, provider/LLM call, UI redesign, deployment or release was performed in this slice.