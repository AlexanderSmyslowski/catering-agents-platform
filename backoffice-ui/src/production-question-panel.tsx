import type { ProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import type { IntakeRequestDetail } from "./api.js";
import { getSpecLabel } from "./production-language.js";
import { ProductionSpecDetailsCard } from "./production-spec-details.js";

type ComponentEditState = {
  menuCategory: string;
  productionMode: string;
  purchasedElements: string;
  recipeOverrideId: string;
  notes: string;
};

type WorkbenchSpecFact = {
  label: string;
  value: string;
};

type ProductionQuestionPanelProps = {
  focusedProductionSpec?: Record<string, unknown>;
  focusedSpecReadinessLabel: string;
  selectedPlan?: Record<string, unknown>;
  selectedPlanReadinessLabel?: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionQuestions: string[];
  productionAssumptions: string[];
  productionConversationProjection: ProductionConversationProjection;
  workbenchSpecFacts: WorkbenchSpecFact[];
  intakeRequestDetailError?: string;
  intakeRequestDetail: IntakeRequestDetail | null;
  submitting: boolean;
  editingSpecId?: string;
  editingEventType: string;
  editingEventDate: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  editingComponentStates: Record<string, ComponentEditState>;
  hasFocusedSpecEditChanges: boolean;
  recipes: Array<Record<string, unknown>>;
  filteredSpecs: Array<Record<string, unknown>>;
  documentPhase: "idle" | "analysing" | "done";
  productionWorkspaceCleared: boolean;
  setEditingEventType: (value: string) => void;
  setEditingEventDate: (value: string) => void;
  setEditingAttendeeCount: (value: string) => void;
  setEditingServiceForm: (value: string) => void;
  setEditingMenuItems: (value: string) => void;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
  beginSpecEdit: (spec: Record<string, unknown>) => void;
  saveSpecEdit: () => Promise<void>;
  createPlan: (spec: Record<string, unknown>) => Promise<void>;
  resetSpecEdit: (markDismissed?: boolean) => void;
  openSpecForQuestions: (specId: string) => void;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function formatSourceMetadataSummary(input: Record<string, unknown>): string | undefined {
  const sourceMetadata = asRecord(input.sourceMetadata);
  const filename = readStringOrNumber(sourceMetadata, ["filename"]);
  const mimeType = readStringOrNumber(sourceMetadata, ["mimeType"]);
  const sizeBytes = sourceMetadata?.sizeBytes;
  const sha256 = readStringOrNumber(sourceMetadata, ["sha256"]);
  const uploadContext = readStringOrNumber(sourceMetadata, ["uploadContext"]);
  const ingestedAt = readStringOrNumber(sourceMetadata, ["ingestedAt"]);

  if (!filename || !mimeType || typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || !sha256 || !uploadContext) {
    return undefined;
  }

  return [
    filename,
    mimeType,
    formatBytes(sizeBytes),
    `sha256:${sha256.slice(0, 12)}`,
    uploadContext,
    ingestedAt
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatDocumentIngestionSummary(input: Record<string, unknown>): string | undefined {
  const marker = asRecord(input.documentIngestion);
  const status = readStringOrNumber(marker, ["status"]);
  const warnings = Array.isArray(marker?.warnings)
    ? marker.warnings.map((warning) => String(warning).trim()).filter(Boolean)
    : [];

  if (!status || (status === "extracted" && warnings.length === 0)) {
    return undefined;
  }

  return [`Status ${status}`, warnings.length > 0 ? `Warnkey ${warnings.join(",")}` : undefined].filter(Boolean).join(" · ");
}

function normalizeRecipeSuggestionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function recipeSuggestionsForComponent(
  label: string,
  recipes: Array<Record<string, unknown>>
): Array<{ recipeId: string; name: string }> {
  const tokens = normalizeRecipeSuggestionText(label)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4)
    .filter((token) => !["vegan", "classic", "klassisch", "vegetarian", "vegetarisch", "topping"].includes(token));

  return recipes
    .map((recipe) => {
      const recipeId = String(recipe.recipeId ?? "");
      const name = String(recipe.name ?? recipeId);
      const haystack = normalizeRecipeSuggestionText(
        `${name} ${String((recipe.source as Record<string, unknown> | undefined)?.reference ?? "")}`
      );
      const score = tokens.filter((token) => haystack.includes(token)).length;
      return {
        recipeId,
        name,
        score
      };
    })
    .filter((item) => item.recipeId && item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "de"))
    .slice(0, 6)
    .map(({ recipeId, name }) => ({ recipeId, name }));
}

function resolveRecipeNameById(
  recipeId: string,
  recipes: Array<Record<string, unknown>>
): string | undefined {
  const match = recipes.find((recipe) => String(recipe.recipeId ?? "") === recipeId);
  if (!match) {
    return undefined;
  }

  const recipeName = String(match.name ?? "").trim();
  return recipeName || recipeId;
}

function ReadOnlyWorkbenchProjection({
  specLabel,
  facts,
  questionCount,
  readinessLabel
}: {
  specLabel: string;
  facts: WorkbenchSpecFact[];
  questionCount: number;
  readinessLabel: string;
}) {
  return (
    <div className="workbench-projection" aria-label="Read-only Workbench-Projektion">
      <div>
        <p className="eyebrow">Workbench-Projektion</p>
        <p className="question-window__spec">{specLabel}</p>
        <p className="helper-text">
          Strukturierte Veranstaltungsdaten bleiben führend; dieser Bereich ist nur eine ruhige read-only Sicht.
        </p>
      </div>
      <dl className="spec-fact-grid">
        {facts.map((fact) => (
          <div key={fact.label} className="spec-fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="clarification-strip">
        <span>Klärbereich</span>
        <strong>{questionCount === 1 ? "1 offene Rückfrage" : `${questionCount} offene Rückfragen`}</strong>
      </div>
      <p className="helper-text">Status: {readinessLabel}</p>
    </div>
  );
}

export function ProductionQuestionPanel({
  focusedProductionSpec,
  focusedSpecReadinessLabel,
  selectedPlan,
  selectedPlanReadinessLabel,
  currentSpecPurchaseLists,
  productionQuestions,
  productionAssumptions,
  productionConversationProjection,
  workbenchSpecFacts,
  intakeRequestDetailError,
  intakeRequestDetail,
  submitting,
  editingSpecId,
  editingEventType,
  editingEventDate,
  editingAttendeeCount,
  editingServiceForm,
  editingMenuItems,
  editingComponentStates,
  hasFocusedSpecEditChanges,
  recipes,
  filteredSpecs,
  documentPhase,
  productionWorkspaceCleared,
  setEditingEventType,
  setEditingEventDate,
  setEditingAttendeeCount,
  setEditingServiceForm,
  setEditingMenuItems,
  updateEditingComponentState,
  beginSpecEdit,
  saveSpecEdit,
  createPlan,
  resetSpecEdit,
  openSpecForQuestions
}: ProductionQuestionPanelProps) {
  return (
    <article className="panel form-panel question-panel production-step-card">
      <header>
        <p className="eyebrow">Strukturierte Rückfragen im Chatfluss</p>
        <h3>Rückfragen des Agenten</h3>
        <p className="helper-text">
          Assistant-Fragen aus den vorhandenen Produktionsdaten; strukturierte Antwortfelder statt freier LLM-Chat.
        </p>
      </header>
      {focusedProductionSpec ? (
        <>
          <div className="question-window">
            <ReadOnlyWorkbenchProjection
              specLabel={getSpecLabel(focusedProductionSpec)}
              facts={workbenchSpecFacts}
              questionCount={productionQuestions.length}
              readinessLabel={focusedSpecReadinessLabel}
            />
            <div className="component-answer-card" aria-label="ConversationSession-Projektion">
              <p className="eyebrow">ConversationSession-Projektion</p>
              <strong>{productionConversationProjection.sessionId}</strong>
              <p className="helper-text">
                Read-only Session-Verlauf aus vorhandenen Spezifikations-, Rückfrage- und Output-Daten.
              </p>
            </div>
            <div className="result-status-strip" aria-label="Ergebnisstatus aktueller Vorgang">
              <span>
                <strong>Ergebnisstatus</strong>
              </span>
              <span>Plan: {selectedPlan ? selectedPlanReadinessLabel ?? "-" : "noch nicht berechnet"}</span>
              <span>Produktionsblatt: {selectedPlan ? "vorhanden" : "offen"}</span>
              <span>
                Einkauf: {currentSpecPurchaseLists.length > 0 ? `${currentSpecPurchaseLists.length} Liste(n)` : "offen"}
              </span>
            </div>
            <div className="structured-chat-thread" aria-label="Strukturierte Rückfragen als Chatfluss">
              {productionConversationProjection.messages.map((message) => {
                if (message.type === "production_output_anchor") {
                  return null;
                }
                if (message.type === "user_structured_answer" && !message.clarificationAnswer) {
                  return null;
                }

                const isClarificationAnswer = message.type === "user_structured_answer";

                return (
                  <article
                    className={
                      isClarificationAnswer
                        ? "structured-chat-message structured-chat-message--user"
                        : "structured-chat-message"
                    }
                    key={message.messageId}
                  >
                    <div
                      className={
                        isClarificationAnswer
                          ? "structured-chat-avatar structured-chat-avatar--user"
                          : "structured-chat-avatar"
                      }
                      aria-hidden="true"
                    >
                      {isClarificationAnswer ? "Du" : message.role === "system" ? "S" : "A"}
                    </div>
                    <div
                      className={
                        isClarificationAnswer
                          ? "structured-chat-bubble structured-chat-bubble--user"
                          : "structured-chat-bubble"
                      }
                    >
                      <div className="structured-chat-bubble__meta">
                        <p className="eyebrow">{message.title}</p>
                        {message.clarificationAnswerStatus ? (
                          <span
                            className={`clarification-status-badge clarification-status-badge--${message.clarificationAnswerStatus}`}
                          >
                            {message.clarificationAnswerStatus === "answered" ? "Rückfrage beantwortet" : "Rückfrage offen"}
                          </span>
                        ) : null}
                      </div>
                      <p>{message.text}</p>
                    </div>
                  </article>
                );
              })}
              {productionConversationProjection.messages
                .filter((message) => message.type === "production_output_anchor")
                .map((message) => (
                  <article className="structured-chat-message" key={message.messageId}>
                    <div className="structured-chat-avatar" aria-hidden="true">
                      A
                    </div>
                    <div className="structured-chat-bubble">
                      <p className="eyebrow">{message.title}</p>
                      <p>{message.text}</p>
                    </div>
                  </article>
                ))}
              {editingSpecId === String(focusedProductionSpec.specId) ? (
                <article className="structured-chat-message structured-chat-message--user">
                  <div className="structured-chat-avatar structured-chat-avatar--user" aria-hidden="true">
                    Du
                  </div>
                  <div className="structured-chat-bubble structured-chat-bubble--user">
                    <header className="structured-answer-anchor">
                      <p className="eyebrow">Deine strukturierte Antwort im Chatfluss</p>
                      <h4 className="subsection-title">Antwort direkt zur Agentenfrage</h4>
                      <p className="helper-text">
                        Diese Felder beantworten die Rückfragen strukturiert im bestehenden Spezifikationspfad; kein freier LLM-Chat.
                      </p>
                    </header>
                    <div className="answer-grid">
                      <label className="field-block">
                        <span>Veranstaltungstyp</span>
                        <select
                          value={editingEventType}
                          onChange={(event) => setEditingEventType(event.target.value)}
                        >
                          <option value="">Bitte wählen</option>
                          <option value="meeting">Besprechung</option>
                          <option value="conference">Konferenz</option>
                          <option value="lunch">Lunch</option>
                          <option value="reception">Empfang</option>
                          <option value="dinner">Abendessen</option>
                          <option value="trade_fair">Messe</option>
                        </select>
                      </label>
                      <label className="field-block">
                        <span>Datum</span>
                        <input
                          value={editingEventDate}
                          onChange={(event) => setEditingEventDate(event.target.value)}
                          placeholder="2026-06-18"
                        />
                      </label>
                      <label className="field-block">
                        <span>Teilnehmerzahl</span>
                        <input
                          value={editingAttendeeCount}
                          onChange={(event) => setEditingAttendeeCount(event.target.value)}
                          inputMode="numeric"
                          placeholder="120"
                        />
                      </label>
                      <label className="field-block">
                        <span>Serviceform</span>
                        <select
                          value={editingServiceForm}
                          onChange={(event) => setEditingServiceForm(event.target.value)}
                        >
                          <option value="">Bitte wählen</option>
                          <option value="buffet">Buffet</option>
                          <option value="plated">Menü am Platz</option>
                          <option value="standing_reception">Empfang / Flying</option>
                          <option value="grab_and_go">Ausgabe / Grab-and-go</option>
                          <option value="coffee_break">Kaffeepause</option>
                        </select>
                      </label>
                    </div>
                    <label className="field-block">
                      <span>Gerichte und Komponenten</span>
                      <textarea
                        value={editingMenuItems}
                        onChange={(event) => setEditingMenuItems(event.target.value)}
                        placeholder="Kalbsbuletten, Kartoffelsalat, Nudelsalat, Mandel-Curry, Schokoladenkuchen"
                      />
                    </label>
                    <p className="helper-text">
                      Mehrere Gerichte bitte durch Komma trennen. Diese Angaben aktualisieren direkt die operative Spezifikation.
                    </p>
                    {Array.isArray(focusedProductionSpec.menuPlan) && focusedProductionSpec.menuPlan.length > 0 ? (
                      <>
                        <div className="divider" />
                        <header>
                          <p className="eyebrow">Gericht für Gericht</p>
                          <h4 className="subsection-title">Klassifikation und Herstellungsart festlegen</h4>
                        </header>
                        <div className="component-answer-list">
                          {focusedProductionSpec.menuPlan.map((entry) => {
                            const component = entry as Record<string, unknown>;
                            const componentId = String(component.componentId ?? "");
                            const state = editingComponentStates[componentId] ?? {
                              menuCategory: "",
                              productionMode: "",
                              purchasedElements: "",
                              recipeOverrideId: "",
                              notes: ""
                            };
                            const componentLabel = String(component.label ?? componentId);
                            const recipeSuggestions = recipeSuggestionsForComponent(componentLabel, recipes);
                            const selectedRecipeName = state.recipeOverrideId
                              ? resolveRecipeNameById(state.recipeOverrideId, recipes)
                              : undefined;
                            const recipeOptions = [...recipeSuggestions];
                            if (
                              state.recipeOverrideId &&
                              !recipeOptions.some((item) => item.recipeId === state.recipeOverrideId)
                            ) {
                              recipeOptions.unshift({
                                recipeId: state.recipeOverrideId,
                                name: selectedRecipeName ?? `Rezept ${state.recipeOverrideId}`
                              });
                            }

                            return (
                              <article key={componentId} className="component-answer-card">
                                <strong>{componentLabel}</strong>
                                <div className="answer-grid">
                                  <label className="field-block">
                                    <span>Kategorie im Angebot</span>
                                    <select
                                      value={state.menuCategory}
                                      onChange={(event) =>
                                        updateEditingComponentState(componentId, {
                                          menuCategory: event.target.value
                                        })
                                      }
                                    >
                                      <option value="">Bitte wählen</option>
                                      <option value="classic">klassisch</option>
                                      <option value="vegetarian">vegetarisch</option>
                                      <option value="vegan">vegan</option>
                                    </select>
                                  </label>
                                  <label className="field-block">
                                    <span>Herstellungsart</span>
                                    <select
                                      value={state.productionMode}
                                      onChange={(event) =>
                                        updateEditingComponentState(componentId, {
                                          productionMode: event.target.value
                                        })
                                      }
                                    >
                                      <option value="">Bitte wählen</option>
                                      <option value="scratch">Eigenproduktion</option>
                                      <option value="hybrid">Hybrid</option>
                                      <option value="convenience_purchase">Convenience-Zukauf</option>
                                      <option value="external_finished">Fertigprodukt / extern</option>
                                    </select>
                                  </label>
                                </div>
                                <label className="field-block">
                                  <span>Rezept gezielt aus Bibliothek zuweisen</span>
                                  <select
                                    value={state.recipeOverrideId}
                                    onChange={(event) =>
                                      updateEditingComponentState(componentId, {
                                        recipeOverrideId: event.target.value
                                      })
                                    }
                                  >
                                    <option value="">Automatisch suchen</option>
                                    {recipeOptions.map((option) => (
                                      <option key={option.recipeId} value={option.recipeId}>
                                        {option.name} ({option.recipeId})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {recipeOptions.length > 0 ? (
                                  <p className="helper-text">
                                    Vorgeschlagene Bibliotheksrezepte:{" "}
                                    {recipeOptions.map((option) => option.name).join(", ")}
                                  </p>
                                ) : (
                                  <p className="helper-text">
                                    Für diese Bezeichnung wurden noch keine naheliegenden Bibliotheksrezepte gefunden.
                                  </p>
                                )}
                                <label className="field-block">
                                  <span>Zugekaufte Bestandteile</span>
                                  <input
                                    value={state.purchasedElements}
                                    onChange={(event) =>
                                      updateEditingComponentState(componentId, {
                                        purchasedElements: event.target.value
                                      })
                                    }
                                    placeholder="z. B. Teig, Blätterteig, fertiger Boden, Saucenbasis"
                                  />
                                </label>
                                <label className="field-block">
                                  <span>Interne Notiz</span>
                                  <input
                                    value={state.notes}
                                    onChange={(event) =>
                                      updateEditingComponentState(componentId, {
                                        notes: event.target.value
                                      })
                                    }
                                    placeholder="optional"
                                  />
                                </label>
                              </article>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </div>
            {productionAssumptions.length > 0 ? (
              <>
                <p className="eyebrow">Annahmen des Agenten</p>
                <ul className="item-list compact">
                  {productionAssumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <ProductionSpecDetailsCard spec={focusedProductionSpec} />
            {intakeRequestDetailError ? (
              <p className="helper-text" role="status">
                {intakeRequestDetailError}
              </p>
            ) : null}
            {intakeRequestDetail ? (
              <div className="component-answer-card">
                <p className="eyebrow">Ursprüngliche Intake-Anfrage</p>
                <p className="helper-text">
                  {`requestId: ${String(intakeRequestDetail.requestId ?? "-")} · channel: ${String(
                    (intakeRequestDetail.source as Record<string, unknown> | undefined)?.channel ?? "-"
                  )} · receivedAt: ${String(
                    (intakeRequestDetail.source as Record<string, unknown> | undefined)?.receivedAt ?? "-"
                  )}`}
                </p>
                <ul className="item-list compact">
                  {Array.isArray(intakeRequestDetail.rawInputs)
                    ? intakeRequestDetail.rawInputs.map((rawInput, index) => {
                        const rawInputRecord = rawInput as Record<string, unknown>;
                        const sourceMetadataSummary = formatSourceMetadataSummary(rawInputRecord);
                        const documentIngestionSummary = formatDocumentIngestionSummary(rawInputRecord);
                        return (
                          <li key={`${String(rawInputRecord.documentId ?? rawInputRecord.kind ?? index)}-${index}`}>
                            <strong>{String(rawInputRecord.kind ?? "-")}</strong>
                            <p className="helper-text">
                              {`${String(rawInputRecord.mimeType ? ` · ${rawInputRecord.mimeType}` : "")}`}
                            </p>
                            {documentIngestionSummary ? (
                              <p className="helper-text">Ingestion-Warnung: {documentIngestionSummary}</p>
                            ) : null}
                            {sourceMetadataSummary ? (
                              <p className="helper-text">Quellenmetadaten (gekürzt): {sourceMetadataSummary}</p>
                            ) : null}
                          </li>
                        );
                      })
                    : null}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={submitting || editingSpecId === String(focusedProductionSpec.specId)}
              onClick={() => beginSpecEdit(focusedProductionSpec)}
            >
              Antworten bearbeiten
            </button>
            {editingSpecId === String(focusedProductionSpec.specId) ? (
              <button
                className="secondary-button"
                disabled={submitting || !hasFocusedSpecEditChanges}
                onClick={() => void saveSpecEdit()}
              >
                Antworten speichern
              </button>
            ) : null}
            <button disabled={submitting} onClick={() => void createPlan(focusedProductionSpec)}>
              {editingSpecId === String(focusedProductionSpec.specId)
                ? "Speichern und Berechnung starten"
                : "Berechnung starten"}
            </button>
          </div>
        </>
      ) : (
        <p className="helper-text">
          {documentPhase === "analysing"
            ? "Der Agent wertet das hochgeladene Dokument gerade aus und erzeugt daraus operative Veranstaltungsdaten."
            : productionWorkspaceCleared
              ? "Der aktuelle Vorgang wurde geleert. Nach einem neuen Upload erscheinen hier wieder die Rückfragen des Agenten."
              : "Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheinen hier die Rückfragen des Agenten."}
        </p>
      )}
      {!productionWorkspaceCleared && filteredSpecs.length > 1 ? (
        <>
          <div className="divider" />
          <header>
            <p className="eyebrow">Erkannte Eingänge</p>
            <h3>Zwischen mehreren Vorgängen wechseln</h3>
          </header>
          <ul className="item-list compact">
            {filteredSpecs.slice(0, 6).map((spec) => (
              <li key={String(spec.specId)}>
                <strong>{getSpecLabel(spec)}</strong>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => openSpecForQuestions(String(spec.specId))}
                  >
                    Für Rückfragen öffnen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {editingSpecId && editingSpecId !== String(focusedProductionSpec?.specId ?? "") ? (
        <>
          <div className="divider" />
          <div className="form-panel">
            <header>
              <p className="eyebrow">Antwortfenster</p>
              <h3>{editingSpecId}</h3>
            </header>
            <input
              value={editingEventType}
              onChange={(event) => setEditingEventType(event.target.value)}
              placeholder="Veranstaltungstyp, z. B. Konferenz"
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
              placeholder="Serviceform, z. B. Buffet"
            />
            <textarea
              value={editingMenuItems}
              onChange={(event) => setEditingMenuItems(event.target.value)}
              placeholder="Menüpunkte, durch Komma getrennt"
            />
            <div className="action-row">
              <button disabled={submitting} onClick={() => void saveSpecEdit()}>
                Antworten speichern
              </button>
              <button className="secondary-button" disabled={submitting} onClick={() => resetSpecEdit()}>
                Fenster schließen
              </button>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}
