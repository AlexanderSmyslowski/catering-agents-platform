import { describe, expect, it } from "vitest";
import { createCaseNextActionRunner } from "../backoffice-ui/src/case-next-action-runner.js";

describe("case next-action busy runner", () => {
  it("suppresses a parallel mutating action and releases busy after success", async () => {
    const busyStates: boolean[] = [];
    let releaseFirst: (() => void) | undefined;
    let executions = 0;
    const firstOperation = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const runner = createCaseNextActionRunner((busy) => busyStates.push(busy));

    const first = runner.run(true, async () => {
      executions += 1;
      await firstOperation;
    });
    const second = await runner.run(true, async () => {
      executions += 1;
    });

    expect(second).toBe(false);
    expect(executions).toBe(1);
    releaseFirst?.();
    expect(await first).toBe(true);
    expect(busyStates).toEqual([true, false]);
  });

  it("releases busy after an error so a later action can run", async () => {
    const busyStates: boolean[] = [];
    const runner = createCaseNextActionRunner((busy) => busyStates.push(busy));

    await expect(runner.run(true, async () => {
      throw new Error("production request failed");
    })).rejects.toThrow("production request failed");

    expect(await runner.run(true, async () => undefined)).toBe(true);
    expect(busyStates).toEqual([true, false, true, false]);
  });
});
