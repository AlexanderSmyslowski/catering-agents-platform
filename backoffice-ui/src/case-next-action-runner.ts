export type CaseNextActionRunner = {
  run: (mutating: boolean, operation: () => Promise<void>) => Promise<boolean>;
};

/**
 * Keep the global command busy for the whole mutating request and reject a
 * second click before React has a chance to repaint the disabled button.
 */
export function createCaseNextActionRunner(setBusy: (busy: boolean) => void): CaseNextActionRunner {
  let mutatingActionInFlight = false;

  return {
    async run(mutating, operation) {
      if (!mutating) {
        await operation();
        return true;
      }
      if (mutatingActionInFlight) {
        return false;
      }

      mutatingActionInFlight = true;
      setBusy(true);
      try {
        await operation();
        return true;
      } finally {
        mutatingActionInFlight = false;
        setBusy(false);
      }
    }
  };
}
