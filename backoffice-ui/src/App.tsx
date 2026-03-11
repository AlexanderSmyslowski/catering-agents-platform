import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState
} from "react";
import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";
import {
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromManualForm,
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
  loadDashboardState,
  loadServiceHealth,
  offerExportUrl,
  persistOperatorName,
  promoteOfferDraft,
  productionExportUrl,
  purchaseListExportUrl,
  readOperatorName,
  reviewRecipe,
  seedDemoData,
  updateAcceptedSpec,
  uploadRecipeFile,
  type DashboardState,
  type IntakeDocumentChannel,
  type RecipeReviewDecision,
  type ServiceHealthState
} from "./api.js";

const emptyState: DashboardState = {
  intakeRequests: [],
  acceptedSpecs: [],
  offerDrafts: [],
  productionPlans: [],
  purchaseLists: [],
  recipes: [],
  auditEvents: []
};

const emptyHealth: ServiceHealthState = {
  intake: {
    service: "intake-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  offers: {
    service: "offer-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  production: {
    service: "production-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  exports: {
    service: "print-export",
    status: "unknown",
    timestamp: "",
    counts: {}
  }
};

function translateEventType(value?: string): string {
  const labels: Record<string, string> = {
    conference: "Konferenz",
    meeting: "Meeting",
    reception: "Empfang",
    dinner: "Dinner",
    fair: "Messe",
    workshop: "Workshop"
  };
  return value ? labels[value] ?? value : "Event";
}

function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollstaendig",
    partial: "teilweise vollstaendig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

function translateHealthStatus(value?: string): string {
  const labels: Record<string, string> = {
    ok: "ok",
    unknown: "unbekannt"
  };
  return value ? labels[value] ?? value : "-";
}

function translateRecipeTier(value?: string): string {
  const labels: Record<string, string> = {
    internal_verified: "intern verifiziert",
    digitized_cookbook: "digitalisiertes Kochbuch",
    internal_approved: "intern freigegeben",
    internet_fallback: "Internet-Fallback"
  };
  return value ? labels[value] ?? value : "-";
}

function translateApprovalState(value?: string): string {
  const labels: Record<string, string> = {
    approved_internal: "intern freigegeben",
    auto_usable: "automatisch nutzbar",
    review_required: "Pruefung noetig",
    rejected: "abgelehnt"
  };
  return value ? labels[value] ?? value : "-";
}

function getSpecLabel(spec: Record<string, unknown>): string {
  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  return `${translateEventType(String(event?.type ?? ""))} | ${attendees?.expected ?? "?"} Teilnehmende | ${event?.date ?? "offen"}`;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "Keine Zaehler";
  }

  const labels: Record<string, string> = {
    requests: "Anfragen",
    acceptedSpecs: "Spezifikationen",
    offerDrafts: "Angebotsentwuerfe",
    productionPlans: "Produktionsplaene",
    purchaseLists: "Einkaufslisten",
    recipes: "Rezepte",
    auditEvents: "Audit-Eintraege"
  };

  return entries
    .map(([label, value]) => `${labels[label] ?? label}: ${value}`)
    .join(" | ");
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyHealth);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [operatorName, setOperatorName] = useState(() => readOperatorName());
  const [intakeText, setIntakeText] = useState(
    "Konferenz am 2026-06-18 fuer 90 Teilnehmer mit Lunchbuffet, Tomatensuppe und Kaffeestation."
  );
  const [manualEventType, setManualEventType] = useState("conference");
  const [manualEventDate, setManualEventDate] = useState("");
  const [manualAttendeeCount, setManualAttendeeCount] = useState("");
  const [manualServiceForm, setManualServiceForm] = useState("buffet");
  const [manualMenuItems, setManualMenuItems] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualVenueName, setManualVenueName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeChannel, setIntakeChannel] = useState<IntakeDocumentChannel>("pdf_upload");
  const [offerText, setOfferText] = useState(
    "Besprechung am 2026-06-25 fuer 35 Teilnehmende mit Kaffeepause, Croissants und Wasserservice."
  );
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [editingSpecId, setEditingSpecId] = useState<string>();
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [editingEventType, setEditingEventType] = useState("");
  const [editingEventDate, setEditingEventDate] = useState("");
  const [editingAttendeeCount, setEditingAttendeeCount] = useState("");
  const [editingServiceForm, setEditingServiceForm] = useState("");
  const [editingMenuItems, setEditingMenuItems] = useState("");
  const deferredSearch = useDeferredValue(search);

  const refreshDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const [state, health] = await Promise.all([
        loadDashboardState(),
        loadServiceHealth()
      ]);
      startTransition(() => {
        setDashboard(state);
        setServiceHealth(health);
        setLoading(false);
      });
    } catch (refreshError) {
      setLoading(false);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Dashboard konnte nicht geladen werden."
      );
    }
  });

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const filteredSpecs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.acceptedSpecs;
    }

    return dashboard.acceptedSpecs.filter((spec) =>
      JSON.stringify(spec).toLowerCase().includes(query)
    );
  }, [dashboard.acceptedSpecs, deferredSearch]);

  const filteredPlans = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.productionPlans;
    }

    return dashboard.productionPlans.filter((plan) =>
      JSON.stringify(plan).toLowerCase().includes(query)
    );
  }, [dashboard.productionPlans, deferredSearch]);

  const filteredAuditEvents = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.auditEvents;
    }

    return dashboard.auditEvents.filter((entry) =>
      JSON.stringify(entry).toLowerCase().includes(query)
    );
  }, [dashboard.auditEvents, deferredSearch]);

  const selectedDraft = useMemo(
    () =>
      dashboard.offerDrafts.find((draft) => String(draft.draftId) === selectedDraftId),
    [dashboard.offerDrafts, selectedDraftId]
  );

  const selectedPlan = useMemo(
    () =>
      dashboard.productionPlans.find((plan) => String(plan.planId) === selectedPlanId),
    [dashboard.productionPlans, selectedPlanId]
  );

  async function handleIntakeSubmit() {
    setSubmitting(true);
    setError(undefined);
    try {
      await createAcceptedSpecFromText(intakeText);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Intake-Text konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOfferSubmit() {
    setSubmitting(true);
    setError(undefined);
    try {
      await createOfferFromText(offerText);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Angebotsentwurf konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIntakeDocumentSubmit() {
    if (!intakeFile) {
      setError("Bitte waehle zuerst ein Dokument aus.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await createAcceptedSpecFromDocument(intakeFile, intakeChannel);
      setIntakeFile(null);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Dokument konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSpecSubmit() {
    setSubmitting(true);
    setError(undefined);
    try {
      await createAcceptedSpecFromManualForm({
        eventType: manualEventType.trim() || undefined,
        eventDate: manualEventDate.trim() || undefined,
        attendeeCount: manualAttendeeCount.trim() ? Number(manualAttendeeCount) : undefined,
        serviceForm: manualServiceForm.trim() || undefined,
        menuItems: manualMenuItems
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        customerName: manualCustomerName.trim() || undefined,
        venueName: manualVenueName.trim() || undefined,
        notes: manualNotes.trim() || undefined
      });
      setManualEventDate("");
      setManualAttendeeCount("");
      setManualMenuItems("");
      setManualCustomerName("");
      setManualVenueName("");
      setManualNotes("");
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Manuelle Spezifikation konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePlan(spec: Record<string, unknown>) {
    setSubmitting(true);
    setError(undefined);
    try {
      await createProductionPlan(spec);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Produktionsplan konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function beginSpecEdit(spec: Record<string, unknown>) {
    const event = spec.event as Record<string, unknown> | undefined;
    const attendees = spec.attendees as Record<string, unknown> | undefined;
    const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan as Array<Record<string, unknown>> : [];

    setEditingSpecId(String(spec.specId));
    setEditingEventType(String(event?.type ?? ""));
    setEditingEventDate(String(event?.date ?? ""));
    setEditingAttendeeCount(String(attendees?.expected ?? ""));
    setEditingServiceForm(String(event?.serviceForm ?? ""));
    setEditingMenuItems(menuPlan.map((item) => String(item.label ?? "")).filter(Boolean).join(", "));
  }

  function resetSpecEdit() {
    setEditingSpecId(undefined);
    setEditingEventType("");
    setEditingEventDate("");
    setEditingAttendeeCount("");
    setEditingServiceForm("");
    setEditingMenuItems("");
  }

  async function handleSaveSpecEdit() {
    if (!editingSpecId) {
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await updateAcceptedSpec(editingSpecId, {
        eventType: editingEventType.trim() || undefined,
        eventDate: editingEventDate.trim() || undefined,
        serviceForm: editingServiceForm.trim() || undefined,
        attendeeCount: editingAttendeeCount.trim()
          ? Number(editingAttendeeCount)
          : undefined,
        menuItems: editingMenuItems
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      resetSpecEdit();
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Spezifikation konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePromoteDraft(draftId: string, variantId?: string) {
    setSubmitting(true);
    setError(undefined);
    try {
      await promoteOfferDraft(draftId, variantId);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Angebotsvariante konnte nicht uebernommen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeUpload(target: "offer" | "production") {
    if (!recipeFile) {
      setError("Bitte waehle zuerst eine Rezeptdatei aus.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await uploadRecipeFile(target, recipeFile, recipeName);
      setRecipeFile(null);
      setRecipeName("");
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Rezept konnte nicht hochgeladen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeedDemoData() {
    setSubmitting(true);
    setError(undefined);
    try {
      await seedDemoData();
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Demo-Daten konnten nicht geladen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeReview(
    target: "offer" | "production",
    recipeId: string,
    decision: RecipeReviewDecision
  ) {
    setSubmitting(true);
    setError(undefined);
    try {
      await reviewRecipe(target, recipeId, decision);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Rezeptpruefung konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOperatorNameChange(value: string) {
    const persisted = persistOperatorName(value);
    setOperatorName(persisted);
  }

  return (
    <DashboardShell title="Catering Backoffice">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Gemeinsamer Live-Betrieb</p>
          <h2>Angebot, Intake und Produktion arbeiten jetzt auf denselben persistenten Vertragsdaten.</h2>
          <p className="lede">
            Das Dashboard spricht die echten Service-APIs an und erlaubt es, Intake-Spezifikationen
            zu erzeugen, Angebotsentwuerfe zu erstellen und Produktionsplaene direkt im Browser auszuloesen.
          </p>
        </div>
        <div className="metrics-grid">
          <StatusCard
            title="Operative Spezifikationen"
            body={`${dashboard.acceptedSpecs.length} persistierte Event-Spezifikationen sind fuer die operative Nutzung verfuegbar.`}
          />
          <StatusCard
            title="Angebotsentwuerfe"
            body={`${dashboard.offerDrafts.length} kundenfaehige Entwuerfe stehen bereit.`}
          />
          <StatusCard
            title="Produktionsplaene"
            body={`${dashboard.productionPlans.length} Kuechenplaene mit verknuepften Einkaufslisten sind vorhanden.`}
          />
          <StatusCard
            title="Rezeptbestand"
            body={`${dashboard.recipes.length} Rezepte sind hinterlegt, inklusive Internet-Fallbacks.`}
          />
          <StatusCard
            title="Audit-Trail"
            body={`${dashboard.auditEvents.length} letzte Aktionen sind mit Bearbeiter-Zuordnung erfasst.`}
          />
        </div>
        <div className="metrics-grid">
          <StatusCard
            title="Intake-Status"
            body={`${translateHealthStatus(serviceHealth.intake.status)} | ${formatCounts(serviceHealth.intake.counts)}`}
          />
          <StatusCard
            title="Angebots-Status"
            body={`${translateHealthStatus(serviceHealth.offers.status)} | ${formatCounts(serviceHealth.offers.counts)}`}
          />
          <StatusCard
            title="Produktions-Status"
            body={`${translateHealthStatus(serviceHealth.production.status)} | ${formatCounts(serviceHealth.production.counts)}`}
          />
          <StatusCard
            title="Export-Status"
            body={`${translateHealthStatus(serviceHealth.exports.status)} | ${formatCounts(serviceHealth.exports.counts)}`}
          />
        </div>
      </section>

      <section className="wide-grid">
        <article className="panel form-panel">
          <header>
            <p className="eyebrow">Manueller Intake</p>
            <h3>Freitext in ein AcceptedEventSpec normalisieren</h3>
          </header>
          <textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} />
          <div className="action-row">
            <button disabled={submitting} onClick={() => void handleIntakeSubmit()}>
              Text normalisieren
            </button>
          </div>
          <div className="divider" />
          <header>
            <p className="eyebrow">Strukturiertes Formular</p>
            <h3>AcceptedEventSpec direkt manuell erfassen</h3>
          </header>
          <input
            value={manualEventType}
            onChange={(event) => setManualEventType(event.target.value)}
            placeholder="Eventtyp, z. B. conference"
          />
          <input
            value={manualEventDate}
            onChange={(event) => setManualEventDate(event.target.value)}
            placeholder="Datum, z. B. 2026-10-10"
          />
          <input
            value={manualAttendeeCount}
            onChange={(event) => setManualAttendeeCount(event.target.value)}
            placeholder="Teilnehmerzahl"
          />
          <input
            value={manualServiceForm}
            onChange={(event) => setManualServiceForm(event.target.value)}
            placeholder="Serviceform, z. B. buffet"
          />
          <input
            value={manualMenuItems}
            onChange={(event) => setManualMenuItems(event.target.value)}
            placeholder="Menuepunkte kommasepariert"
          />
          <input
            value={manualCustomerName}
            onChange={(event) => setManualCustomerName(event.target.value)}
            placeholder="Kundenname"
          />
          <input
            value={manualVenueName}
            onChange={(event) => setManualVenueName(event.target.value)}
            placeholder="Ort / Venue"
          />
          <textarea
            value={manualNotes}
            onChange={(event) => setManualNotes(event.target.value)}
            placeholder="Interne Notizen oder Einschraenkungen"
          />
          <div className="action-row">
            <button disabled={submitting} onClick={() => void handleManualSpecSubmit()}>
              Manuelle Spezifikation anlegen
            </button>
          </div>
          <div className="divider" />
          <header>
            <p className="eyebrow">Dokumenten-Intake</p>
            <h3>PDF-, E-Mail- oder Textdateien hochladen</h3>
          </header>
          <select
            className="operator-input"
            value={intakeChannel}
            onChange={(event) => setIntakeChannel(event.target.value as IntakeDocumentChannel)}
          >
            <option value="pdf_upload">PDF / Angebot</option>
            <option value="email">E-Mail</option>
            <option value="text">Textdatei</option>
          </select>
          <input
            className="file-input"
            type="file"
            accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
            onChange={(event) => setIntakeFile(event.target.files?.[0] ?? null)}
          />
          <p className="helper-text">
            Diese Schicht fuehrt manuelle Dateien direkt in dasselbe AcceptedEventSpec wie der Agent-1-Pfad.
          </p>
          <div className="action-row">
            <button disabled={submitting} onClick={() => void handleIntakeDocumentSubmit()}>
              Dokument normalisieren
            </button>
          </div>
          {intakeFile ? <p className="helper-text">Ausgewaehlt: {intakeFile.name}</p> : null}
        </article>

        <article className="panel form-panel">
          <header>
            <p className="eyebrow">Angebotsbereich</p>
            <h3>Angebotsentwurf aus Freitext erstellen</h3>
          </header>
          <textarea value={offerText} onChange={(event) => setOfferText(event.target.value)} />
          <button disabled={submitting} onClick={() => void handleOfferSubmit()}>
            Angebot entwerfen
          </button>
        </article>

        <article className="panel form-panel">
          <header>
            <p className="eyebrow">Rezeptbibliothek</p>
            <h3>PDF- oder Textrezepte in die gemeinsame Bibliothek hochladen</h3>
          </header>
          <input
            value={recipeName}
            onChange={(event) => setRecipeName(event.target.value)}
            placeholder="Optionaler Rezeptname"
          />
          <input
            className="file-input"
            type="file"
            accept=".pdf,.txt,.md,text/plain,application/pdf"
            onChange={(event) => setRecipeFile(event.target.files?.[0] ?? null)}
          />
          <p className="helper-text">
            Uploads ueber Angebots- oder Produktionsagent erweitern dieselbe Rezeptbibliothek.
          </p>
          <div className="action-row">
            <button disabled={submitting} onClick={() => void handleRecipeUpload("offer")}>
              Zum Angebotsagenten hochladen
            </button>
            <button disabled={submitting} onClick={() => void handleRecipeUpload("production")}>
              Zur Produktion hochladen
            </button>
          </div>
          {recipeFile ? <p className="helper-text">Ausgewaehlt: {recipeFile.name}</p> : null}
        </article>
      </section>

      <section className="toolbar">
        <input
          className="operator-input"
          placeholder="Bearbeitername"
          value={operatorName}
          onChange={(event) => handleOperatorNameChange(event.target.value)}
        />
        <input
          className="search"
          placeholder="Spezifikationen, Plaene oder Entwuerfe filtern"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button disabled={loading || submitting} onClick={() => void handleSeedDemoData()}>
          Demo-Daten laden
        </button>
        <button disabled={loading || submitting} onClick={() => void refreshDashboard()}>
          Aktualisieren
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="wide-grid">
        <article className="panel">
          <header>
            <p className="eyebrow">AcceptedEventSpec</p>
            <h3>Operative Event-Eingaben</h3>
          </header>
          <ul className="item-list">
            {filteredSpecs.map((spec) => (
              <li key={String(spec.specId)} className="list-row">
                <div>
                  <strong>{getSpecLabel(spec)}</strong>
                  <p>Status: {translateReadiness(String((spec.readiness as Record<string, unknown>)?.status ?? "-"))}</p>
                </div>
                <div className="action-row">
                  <button
                    disabled={submitting}
                    onClick={() => void handleCreatePlan(spec)}
                  >
                    Produktion planen
                  </button>
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => beginSpecEdit(spec)}
                  >
                    Nachbearbeiten
                  </button>
                </div>
              </li>
            ))}
            {filteredSpecs.length === 0 ? <li>Noch keine Spezifikationen vorhanden.</li> : null}
          </ul>
          {editingSpecId ? (
            <>
              <div className="divider" />
              <div className="form-panel">
                <header>
                  <p className="eyebrow">Spezifikation bearbeiten</p>
                  <h3>{editingSpecId}</h3>
                </header>
                <input
                  value={editingEventType}
                  onChange={(event) => setEditingEventType(event.target.value)}
                  placeholder="Eventtyp, z. B. conference"
                />
                <input
                  value={editingEventDate}
                  onChange={(event) => setEditingEventDate(event.target.value)}
                  placeholder="Datum, z. B. 2026-06-18"
                />
                <input
                  value={editingAttendeeCount}
                  onChange={(event) => setEditingAttendeeCount(event.target.value)}
                  placeholder="Teilnehmerzahl"
                />
                <input
                  value={editingServiceForm}
                  onChange={(event) => setEditingServiceForm(event.target.value)}
                  placeholder="Serviceform, z. B. buffet"
                />
                <textarea
                  value={editingMenuItems}
                  onChange={(event) => setEditingMenuItems(event.target.value)}
                  placeholder="Menuepunkte kommasepariert"
                />
                <div className="action-row">
                  <button disabled={submitting} onClick={() => void handleSaveSpecEdit()}>
                    Spezifikation speichern
                  </button>
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => resetSpecEdit()}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Audit-Trail</p>
            <h3>Letzte Bearbeitungsschritte ueber alle Services</h3>
          </header>
          <ul className="item-list compact">
            {filteredAuditEvents.map((entry) => (
              <li key={String(entry.auditId)}>
                <strong>{String(entry.summary ?? entry.action ?? entry.auditId)}</strong>
                <p className="helper-text">
                  {String(entry.at ?? "-")} | {String((entry.actor as Record<string, unknown>)?.name ?? "-")} |{" "}
                  {String(entry.action ?? "-")}
                </p>
              </li>
            ))}
            {filteredAuditEvents.length === 0 ? <li>Noch keine Audit-Eintraege vorhanden.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Produktion</p>
            <h3>Kuechenausgabe und Rezeptcache</h3>
          </header>
          <ul className="item-list compact">
            {filteredPlans.map((plan) => (
              <li key={String(plan.planId)}>
                <strong>{String(plan.planId)}</strong>
                <p>Status: {translateReadiness(String((plan.readiness as Record<string, unknown>)?.status ?? "-"))}</p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => setSelectedPlanId(String(plan.planId))}
                  >
                    Details
                  </button>
                </div>
                <a
                  className="ghost-link"
                  href={productionExportUrl(String(plan.planId))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Produktionsblatt exportieren
                </a>
              </li>
            ))}
            {filteredPlans.length === 0 ? <li>Noch keine Produktionsplaene vorhanden.</li> : null}
          </ul>
          <div className="divider" />
          {selectedPlan ? (
            <>
              <header>
                <p className="eyebrow">Plan-Details</p>
                <h3>{String(selectedPlan.planId)}</h3>
              </header>
              <p>
                Offene Punkte:{" "}
                {Array.isArray(selectedPlan.unresolvedItems) && selectedPlan.unresolvedItems.length > 0
                  ? selectedPlan.unresolvedItems.join(" | ")
                  : "keine"}
              </p>
              <ul className="item-list compact">
                {Array.isArray(selectedPlan.recipeSelections)
                  ? selectedPlan.recipeSelections.map((selection) => {
                      const selectionRecord = selection as Record<string, unknown>;
                      return (
                        <li key={String(selectionRecord.componentId)}>
                          <strong>{String(selectionRecord.componentId)}</strong>
                          <p>{String(selectionRecord.selectionReason ?? "-")}</p>
                        </li>
                      );
                    })
                  : null}
              </ul>
            </>
          ) : null}
          <div className="divider" />
          <ul className="item-list compact">
            {dashboard.recipes.slice(0, 8).map((recipe) => (
              <li key={String(recipe.recipeId)}>
                <strong>{String(recipe.name)}</strong>
                <p>
                  {translateRecipeTier(String((recipe.source as Record<string, unknown>)?.tier ?? "-"))} |{" "}
                  {translateApprovalState(String((recipe.source as Record<string, unknown>)?.approvalState ?? "-"))}
                </p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() =>
                      void handleRecipeReview("production", String(recipe.recipeId), "approve")
                    }
                  >
                    Freigeben
                  </button>
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() =>
                      void handleRecipeReview("production", String(recipe.recipeId), "verify")
                    }
                  >
                    Verifizieren
                  </button>
                  <button
                    className="secondary-button destructive-button"
                    disabled={submitting}
                    onClick={() =>
                      void handleRecipeReview("production", String(recipe.recipeId), "reject")
                    }
                  >
                    Ablehnen
                  </button>
                </div>
              </li>
            ))}
            {dashboard.recipes.length === 0 ? <li>Noch keine Rezepte vorhanden.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Angebotsentwuerfe</p>
            <h3>Aktuelle kaufmaennische Ergebnisse</h3>
          </header>
          <ul className="item-list compact">
            {dashboard.offerDrafts.map((draft) => (
              <li key={String(draft.draftId)}>
                <strong>{String(draft.draftId)}</strong>
                <p>{String(draft.eventSummary ?? "-")}</p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => setSelectedDraftId(String(draft.draftId))}
                  >
                    Details
                  </button>
                  {Array.isArray(draft.variantSet)
                    ? draft.variantSet.map((variant) => {
                        const variantRecord = variant as Record<string, unknown>;
                        return (
                          <button
                            key={String(variantRecord.variantId)}
                            className="secondary-button"
                            disabled={submitting}
                            onClick={() =>
                              void handlePromoteDraft(
                                String(draft.draftId),
                                String(variantRecord.variantId)
                              )
                            }
                          >
                            {`Als Spezifikation uebernehmen: ${String(variantRecord.label ?? variantRecord.variantId)}`}
                          </button>
                        );
                      })
                    : null}
                </div>
                <a
                  className="ghost-link"
                  href={offerExportUrl(String(draft.draftId))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Angebot exportieren
                </a>
              </li>
            ))}
            {dashboard.offerDrafts.length === 0 ? <li>Noch keine Angebotsentwuerfe vorhanden.</li> : null}
          </ul>
          {selectedDraft ? (
            <>
              <div className="divider" />
              <header>
                <p className="eyebrow">Entwurfs-Details</p>
                <h3>{String(selectedDraft.draftId)}</h3>
              </header>
              <p>{String(selectedDraft.eventSummary ?? "-")}</p>
              <pre className="detail-pre">{String(selectedDraft.customerFacingText ?? "")}</pre>
              <pre className="detail-pre">{String(selectedDraft.internalWorkingText ?? "")}</pre>
            </>
          ) : null}
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Einkaufslisten</p>
            <h3>CSV-faehige Beschaffungslisten</h3>
          </header>
          <ul className="item-list compact">
            {dashboard.purchaseLists.map((purchaseList) => (
              <li key={String(purchaseList.purchaseListId)}>
                <strong>{String(purchaseList.purchaseListId)}</strong>
                <p>Positionen: {String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}</p>
                <a
                  className="ghost-link"
                  href={purchaseListExportUrl(String(purchaseList.purchaseListId))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Einkaufsliste CSV
                </a>
              </li>
            ))}
            {dashboard.purchaseLists.length === 0 ? <li>Noch keine Einkaufslisten vorhanden.</li> : null}
          </ul>
        </article>
      </section>

      <footer className="footer-note">
        {loading ? "Live-Plattformdaten werden geladen..." : "Live-Daten aus Intake-, Angebots- und Produktionsservice geladen."}
      </footer>
    </DashboardShell>
  );
}
