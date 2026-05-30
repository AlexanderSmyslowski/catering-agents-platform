import { describe, expect, it } from "vitest";
import { buildAppRouteShellState } from "../backoffice-ui/src/app-route-shell-state.js";
import type { AppRouteShellStateInput } from "../backoffice-ui/src/app-route-shell-state.js";

const noop = () => undefined;
const noopAsync = async () => undefined;

function buildInput(route: AppRouteShellStateInput["route"]): AppRouteShellStateInput {
  return {
    route,
    baseUrl: "https://catering.local",
    operatorName: "Kueche",
    loading: false,
    submitting: true,
    onOperatorNameChange: noop,
    onSeedDemoData: noopAsync,
    onRefreshDashboard: noopAsync
  };
}

describe("app route shell state", () => {
  it("maps route-dependent shell chrome out of App without changing labels", () => {
    expect(buildAppRouteShellState(buildInput("home")).shell).toEqual({
      title: "Catering-Agenten",
      subtitle: "Zwei spezialisierte Arbeitsflächen mit gemeinsamem Regelkern und klar getrennten Zuständigkeiten.",
      hideKicker: false,
      className: undefined
    });
    expect(buildAppRouteShellState(buildInput("offer")).shell).toEqual({
      title: "Angebotsagent",
      subtitle: "Kundenanfrage verstehen, Leistungen strukturieren und daraus belastbare Angebotsentwürfe erzeugen.",
      hideKicker: true,
      className: "app-shell--offer-route"
    });
    expect(buildAppRouteShellState(buildInput("production")).shell).toEqual({
      title: "Produktionsagent",
      subtitle: "Ruhige Arbeitsfläche für Rezepte, Produktionspläne und Einkaufslisten.",
      hideKicker: true,
      className: "app-shell--production-route"
    });
  });

  it("keeps masthead props and callback references unchanged", () => {
    const input = buildInput("offer");
    const state = buildAppRouteShellState(input);

    expect(state.masthead).toEqual(input);
    expect(state.masthead.onOperatorNameChange).toBe(input.onOperatorNameChange);
    expect(state.masthead.onSeedDemoData).toBe(input.onSeedDemoData);
    expect(state.masthead.onRefreshDashboard).toBe(input.onRefreshDashboard);
  });
});
