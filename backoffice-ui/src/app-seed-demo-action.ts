import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type AppSeedDemoActionInput = {
  seedDemoData: () => Promise<Record<string, unknown>>;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildAppSeedDemoAction({
  seedDemoData,
  setSubmitting,
  clearMessages,
  refreshDashboard,
  setNotice,
  setError
}: AppSeedDemoActionInput) {
  return async function handleSeedDemoData() {
    setSubmitting(true);
    clearMessages();
    try {
      await seedDemoData();
      await refreshDashboard();
      setNotice("Demo-Daten wurden geladen.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Demo-Daten konnten nicht geladen werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
